// Verify server-side trajectory JSONL without importing it into training or publishing it.
import { createReadStream } from 'node:fs';
import { stat, readdir, open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { SCHEMA } from '../server/match/trajectory.js';

async function verify(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size === 0 || info.size > 64 * 1024 * 1024) throw new Error('Empty, non-file or oversized capture');
  const fd = await open(file, 'r');
  try {
    const last = Buffer.alloc(1);
    await fd.read(last, 0, 1, info.size - 1);
    if (last[0] !== 10) throw new Error('Missing final newline: incomplete write');
  } finally { await fd.close(); }
  const hash = createHash('sha256');
  let header = null, footer = null, seq = 0, resultSeen = false, parsedBytes = 0;
  const counts = { states: 0, actions: 0, accepted: 0, rejected: 0, moves: 0,
    upgrades: 0, confirmedUpgrades: 0, outcomes: 0 };
  const stream = createReadStream(file, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let inputError = null;
  stream.on('error', error => { inputError = error; lines.close(); });
  try {
    for await (const line of lines) {
      parsedBytes += Buffer.byteLength(line + '\n');
      if (!line || footer) throw new Error('Blank line or data after footer');
      const row = JSON.parse(line);
      const pending = [row];
      while (pending.length) {
        const entry = pending.pop();
        if (entry && typeof entry === 'object') {
          for (const [key, value] of Object.entries(entry)) {
            if (/seed|rng|hiddenBossId/i.test(key)) throw new Error('Forbidden hidden-state field');
            if (value && typeof value === 'object') pending.push(value);
          }
        }
      }
      if (row.seq !== seq) throw new Error(`Sequence gap at ${seq}`);
      if (seq === 0) {
        if (row.kind !== 'header' || row.schema !== SCHEMA) throw new Error('Unsupported trajectory header/schema');
        header = row;
      } else if (row.kind === 'footer') {
        if (row.rows !== seq || row.rowsSha256 !== hash.digest('hex')) throw new Error('Footer row count/checksum mismatch');
        if (!['settled', 'interrupted', 'truncated', 'capture-error'].includes(row.status)) throw new Error('Unknown capture status');
        if (row.complete !== (row.status === 'settled' && header.startedFromLobby && resultSeen)) throw new Error('Invalid completeness claim');
        footer = row;
      } else if (row.kind === 'state') {
        if (!row.state?.own || !row.state?.public) throw new Error('Missing state views');
        counts.states++;
      } else if (row.kind === 'action') {
        if (!row.before?.own || !row.before?.public || !row.after?.own || !row.after?.public
          || typeof row.action?.t !== 'string' || typeof row.accepted !== 'boolean') throw new Error('Incomplete action row');
        if (!(row.action.t.startsWith('g.') || ['room.loadout', 'room.rerollSetup', 'room.cancelReroll'].includes(row.action.t))) throw new Error('Unknown action origin');
        counts.actions++;
        counts[row.accepted ? 'accepted' : 'rejected']++;
        if (row.accepted && row.action.t === 'g.move') counts.moves++;
        if (row.action.t === 'g.levelUp') {
          counts.upgrades++;
          if (row.accepted && row.after.own.shop.level === row.before.own.shop.level + 1) counts.confirmedUpgrades++;
        }
      } else if (row.kind === 'outcome-message') {
        if (!['m.result', 'b.end'].includes(row.message?.t)) throw new Error('Unknown outcome message');
        counts.outcomes++;
        resultSeen ||= row.message.t === 'm.result';
      } else throw new Error('Unsupported row kind');
      if (row.kind !== 'footer') hash.update(line + '\n');
      seq++;
    }
  } finally { lines.close(); stream.destroy(); }
  if (inputError) throw inputError;
  if (parsedBytes !== info.size) throw new Error('Noncanonical line endings or file changed while reading');
  if (!header || !footer) throw new Error('Missing header/footer: interrupted or damaged capture');
  return { file, valid: true, schema: header.schema, appVersion: header.appVersion,
    codeRevision: header.codeRevision, dataSha256: header.content?.dataSha256,
    captureId: header.captureId, seat: header.seat, complete: footer.complete, status: footer.status,
    rows: seq, bytes: info.size, counts, source: header.source };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== 'verify' || args.length < 2) {
    console.error('Usage: node tools/trajectory.mjs verify <file-or-directory> [--require-complete]');
    process.exitCode = 1; return;
  }
  const target = path.resolve(args[1]);
  const info = await stat(target);
  const files = info.isDirectory()
    ? (await readdir(target)).filter(name => name.endsWith('.jsonl')).sort().map(name => path.join(target, name))
    : [target];
  if (!files.length) throw new Error('No JSONL captures found');
  const reports = [];
  for (const file of files) {
    try {
      const report = await verify(file);
      reports.push(report);
      if (args.includes('--require-complete') && !report.complete) process.exitCode = 1;
    } catch (error) { reports.push({ file, valid: false, error: error.message }); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ files: reports }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
