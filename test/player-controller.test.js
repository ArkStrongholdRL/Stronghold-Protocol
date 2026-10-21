import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.js';
import { TestClient } from './helpers/wsClient.js';
import { makeMatch } from './match/harness.js';
import { validateC2S } from '../shared/protocol.js';
import { normalizeController } from '../shared/playerController.js';
import { buildResult } from '../server/match/results.js';
import { installTrajectory } from '../server/match/trajectory.js';
import { buildRecord, compactRecord, importStats, exportStats, emptyStats, migrateStats } from '../public/js/ui/stats.js';
import { normalizeResult } from '../public/js/ui/gameLogic/result.js';

const llm = { kind: 'llm', client: 'dsh-plugin' };
const human = { kind: 'human', client: 'web' };
const hello = controller => ({ t: 'hello', name: 'Doctor', version: 1, ...(controller ? { controller } : {}) });

test('hello validates bounded declarations; bot identity is server-owned and legacy is unknown', () => {
  for (const declaration of [llm, human, { kind: 'llm', client: 'codex-mcp' }]) {
    assert.equal(validateC2S(hello(declaration)), null);
    assert.deepEqual(normalizeController(declaration), declaration);
  }
  for (const declaration of [{ kind: 'bot' }, { kind: 'llm', client: 'fake' }, { kind: 'human', token: 'secret' }, 'llm']) {
    assert.ok(validateC2S(hello(declaration)));
  }
  assert.equal(normalizeController(null).kind, 'unknown');
  assert.equal(normalizeController(llm, true).kind, 'bot');
});

test('real socket declaration reaches room and match, survives resume and records LLM participation after handoff', { timeout: 15000 }, async t => {
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  const clients = [];
  t.after(async () => { await Promise.all(clients.map(c => c.close())); await srv.close(); });
  async function connect(controller, token) {
    const c = await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`); clients.push(c);
    const welcome = await c.request({ ...hello(controller), ...(token ? { token } : {}) });
    assert.equal(welcome.t, 'welcome'); return { c, welcome };
  }
  const { c, welcome } = await connect(llm);
  assert.deepEqual(welcome.controller, llm);
  assert.equal((await c.request({ t: 'room.create', mode: 'solo', difficulty: 'NORMAL' })).t, 'ok');
  const room = await c.waitFor('room.state');
  assert.deepEqual(room.seats[0].controller, llm);
  assert.equal(room.seats[0].isBot, false);
  assert.equal((await c.request({ t: 'room.start' })).t, 'ok');
  assert.deepEqual((await c.waitFor('m.public')).players[0].controller, llm);
  await c.close();
  const resumed = await connect(llm, welcome.token);
  assert.equal(resumed.welcome.resumed, true);
  assert.deepEqual((await resumed.c.waitFor('m.public')).players[0].controller, llm);
  // Same socket can re-identify its source; a full state resend may be throttled, metadata must still publish.
  await resumed.c.request(hello(human));
  const view = await resumed.c.waitFor('m.public', m => m.players[0].controller?.kind === 'human');
  assert.equal(view.players[0].llmUsed, true);
  assert.equal(view.players[0].isBot, false);
  const legacy = await connect();
  assert.equal(legacy.welcome.controller.kind, 'unknown');
});

test('controller handoff is metadata only; results, trajectories and stored/compacted records retain it', t => {
  const directory = mkdtempSync(join(tmpdir(), 'sp-controller-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const h = makeMatch({ mode: 'solo', seats: [{ seat: 0, playerId: 'p_0', name: 'Doctor', isBot: false, connected: true, controller: human }] });
  t.after(() => h.m.dispose());
  installTrajectory(h.m, { directory });
  h.start();
  const ps = h.ps('p_0');
  const before = { phase: h.m.phase, ready: ps.infoReady, autoplay: ps.autoplay, money: ps.funds };
  h.m.setController('p_0', llm);
  h.m.setController('p_0', human);
  assert.deepEqual({ phase: h.m.phase, ready: ps.infoReady, autoplay: ps.autoplay, money: ps.funds }, before);
  assert.equal(ps.llmUsed, true);
  const result = buildResult(h.m, { victory: false, reason: 'test' });
  assert.deepEqual(result.players[0].controller, human);
  assert.equal(result.players[0].llmUsed, true);
  const normalized = normalizeResult(result, h.m.publicView());
  assert.equal(normalized.players[0].llmUsed, true);
  const record = buildRecord(result, { myId: 'p_0', now: 10 });
  const compact = compactRecord(record);
  const restored = importStats(JSON.parse(JSON.stringify(exportStats({ ...emptyStats(), records: [compact] }))), emptyStats());
  assert.equal(restored.stats.records[0].players[0].llmUsed, true);
  assert.deepEqual(restored.stats.records[0].players[0].controller, human);
  const old = { ...record, players: [{ playerId: 'p_0', name: 'Legacy' }] };
  const migrated = migrateStats({ v: 2, records: [old] });
  assert.equal(migrated.stats.records[0].players[0].controller.kind, 'unknown');
  assert.equal(migrated.stats.records[0].players[0].llmUsed, false);
  h.m.dispose();
  const rows = readFileSync(join(directory, readdirSync(directory)[0]), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(rows[0].controller, human);
  const transitions = rows.filter(row => row.kind === 'state' && row.reason === 'setController');
  assert.deepEqual(transitions.map(row => row.state.control.controller.kind), ['llm', 'human']);
  assert.equal(transitions[1].state.control.llmUsed, true);
});
