import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMatch } from './harness.js';
import { installTrajectory } from '../../server/match/trajectory.js';

const verifier = fileURLToPath(new URL('../../tools/trajectory.mjs', import.meta.url));
function temp(t) {
  const directory = mkdtempSync(join(tmpdir(), 'sp-trajectory-seed-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function capture(t, seed = 123456789) {
  const directory = temp(t), h = makeMatch({ mode: 'solo', seed });
  t.after(() => h.m.dispose());
  installTrajectory(h.m, { directory });
  h.start().toPrep(1);
  h.m.handle('p_0', { t: 'g.refresh' });
  h.m.dispose();
  const file = join(directory, readdirSync(directory)[0]);
  return { file, rows: readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse), h };
}
function writeRows(file, rows) {
  const body = rows.slice(0, -1).map(row => JSON.stringify(row) + '\n').join('');
  const footer = { ...rows.at(-1), rowsSha256: createHash('sha256').update(body).digest('hex') };
  writeFileSync(file, body + JSON.stringify(footer) + '\n');
}
function verify(file) {
  const result = spawnSync(process.execPath, [verifier, 'verify', file], { encoding: 'utf8' });
  assert.equal(result.error, undefined);
  return { status: result.status, report: JSON.parse(result.stdout).files[0] };
}

test('header records the actual normalized master seed once without changing views or random draws', t => {
  for (const seed of [0, -1, 0x100000001]) {
    const { rows, h } = capture(t, seed);
    const baseline = makeMatch({ mode: 'solo', seed });
    t.after(() => baseline.m.dispose());
    baseline.start().toPrep(1);baseline.m.handle('p_0', { t: 'g.refresh' });
    assert.equal(rows[0].seed, (seed >>> 0) || 1);
    assert.equal(rows.filter(row => Object.hasOwn(row, 'seed')).length, 1);
    assert.doesNotMatch(JSON.stringify(rows.slice(1)), /"[^"\\]*(?:seed|rng|hiddenBossId)[^"\\]*":/i);
    assert.deepEqual(h.m.publicView(), baseline.m.publicView());
    assert.deepEqual(h.ps('p_0').privateView(), baseline.ps('p_0').privateView());
    for (const name of ['Setup', 'Shop', 'Waves', 'Draft', 'Bots', 'Meta']) assert.equal(h.m['rng' + name].state(), baseline.m['rng' + name].state());
  }
});

test('verifier accepts seeded and legacy v1 captures and reports missing legacy seed as null', t => {
  const { file, rows } = capture(t);
  const seeded = verify(file);assert.equal(seeded.status, 0);assert.equal(seeded.report.seed, 123456789);
  delete rows[0].seed;writeRows(file, rows);
  const legacy = verify(file);assert.equal(legacy.status, 0);assert.equal(legacy.report.seed, null);
});

test('verifier rejects malformed header seeds and seed/RNG fields anywhere else even with a valid checksum', t => {
  const { file, rows } = capture(t);
  for (const seed of [0, -1, 1.5, 0x100000000, '1', null, { value: 1 }]) {
    const altered = structuredClone(rows);altered[0].seed = seed;writeRows(file, altered);
    const r = verify(file);assert.equal(r.status, 1);assert.match(r.report.error, /Invalid header seed/);
  }
  for (const edit of [r => { r[0].nested = { seed: 1 }; }, r => { r[1].seed = 1; }, r => { r[0].rngState = 1; }, r => { r[0].hiddenBossId = 'secret'; }]) {
    const altered = structuredClone(rows);edit(altered);writeRows(file, altered);
    const r = verify(file);assert.equal(r.status, 1);assert.match(r.report.error, /Forbidden hidden-state field/);
  }
});
