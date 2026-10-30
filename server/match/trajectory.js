// Optional server-side human-seat trajectory capture. Node only; never imported by the battle sim.
import { mkdirSync, openSync, writeSync, closeSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const SCHEMA = 'stronghold-human-seat-trajectory/v1';
const MAX_BYTES = 64 * 1024 * 1024;
const FOOTER_RESERVE = 4096;
// The native public transport currently includes an unrevealed hiddenBossId.
// Keep it and seed/RNG fields out of demonstration views and captured messages.
const copy = value => JSON.parse(JSON.stringify(value,
  (key, entry) => /seed|rng|hiddenBossId/i.test(key) ? undefined : entry));
const dataHashes = new WeakMap();

/** Capture only publicView and this seat's privateView; never tokens, pool stock or RNG state. */
export function installTrajectory(match, { directory = process.env.SP_TRAJECTORY_DIR, appVersion = null } = {}) {
  if (!directory || match.test) return null;
  const writers = new Map();
  const captureId = randomUUID();
  let closed = false;
  let phaseKey = null;
  const warn = error => { try { match.log?.warn?.(`[trajectory] ${String(error.message || error)}`); } catch { /* observer only */ } };

  function rawWrite(writer, event) {
    const bytes = Buffer.from(JSON.stringify({ ...event, seq: writer.seq }) + '\n');
    let offset = 0;
    // loop-cap: every successful write advances offset by >= 1, bounded by bytes.length; zero progress throws.
    while (offset < bytes.length) {
      const n = writeSync(writer.fd, bytes, offset, bytes.length - offset);
      if (n <= 0) throw new Error('short trajectory write');
      offset += n;
    }
    writer.bytes += bytes.length;
    writer.seq += 1;
    return bytes;
  }

  function closeWriter(writer, status) {
    if (writer.fd == null) return;
    const fd = writer.fd;
    try {
      rawWrite(writer, { kind: 'footer', status, complete: status === 'settled' && writer.fromStart && writer.resultSeen,
        rows: writer.seq, rowsSha256: writer.hash.digest('hex') });
    } catch (error) { warn(error); }
    finally { writer.fd = null; try { closeSync(fd); } catch (error) { warn(error); } }
  }

  function emit(writer, event) {
    if (writer.fd == null) return;
    try {
      // Refuse the whole row. Never silently drop history while claiming completeness.
      const size = Buffer.byteLength(JSON.stringify({ ...event, seq: writer.seq }) + '\n');
      if (writer.bytes + size > MAX_BYTES - FOOTER_RESERVE) {
        closeWriter(writer, 'truncated');
        warn(new Error('trajectory reached 64 MiB; capture is marked truncated'));
        return;
      }
      writer.hash.update(rawWrite(writer, event));
    } catch (error) {
      warn(error);
      const fd = writer.fd; writer.fd = null;
      try { closeSync(fd); } catch { /* incomplete file intentionally has no success footer */ }
    }
  }

  function stateFor(playerId) {
    const ps = match.players.get(playerId);
    const field = match.deployFieldOf(ps);
    const cells = [...match.deployMapFor(ps, field)].map(([key, kind]) => {
      const [row, col] = key.split(',').map(Number);
      return { row, col, kind };
    });
    return copy({ public: match.publicView(), own: ps.privateView(),
      deployment: { field, cells },
      control: { controller: ps.controller, llmUsed: ps.llmUsed, connected: ps.connected, autoplay: !!ps.autoplay, left: !!ps.left } });
  }

  function snapshot(playerId, reason) {
    const writer = writers.get(playerId);
    if (!writer || writer.fd == null) return;
    try { emit(writer, { kind: 'state', reason, state: stateFor(playerId) }); }
    catch (error) { closeWriter(writer, 'capture-error'); warn(error); }
  }

  try {
    if (!dataHashes.has(match.data)) {
      dataHashes.set(match.data, createHash('sha256').update(JSON.stringify(match.data)).digest('hex'));
    }
    mkdirSync(path.resolve(directory), { recursive: true, mode: 0o700 });
    for (const ps of match.order) {
      if (ps.isBot || ps.spectator) continue;
      const filename = `${captureId}-seat${ps.seat}.jsonl`;
      const writer = { fd: openSync(path.join(path.resolve(directory), filename), 'wx', 0o600),
        seq: 0, bytes: 0, hash: createHash('sha256'), fromStart: match.phase === 'LOBBY', resultSeen: false };
      writers.set(ps.playerId, writer);
      emit(writer, { kind: 'header', schema: SCHEMA, captureId, seat: ps.seat, playerId: ps.playerId, appVersion,
        source: 'human-seat-client-intents', controller: ps.controller, llmUsed: ps.llmUsed, content: { cs: match.cs ?? null, vs: match.vs ?? null,
          dataSha256: dataHashes.get(match.data), dataHashEncoding: 'JSON.stringify(match.data)' },
        codeRevision: process.env.SP_TRAJECTORY_REVISION || null,
        startedAt: new Date().toISOString(), roomMode: match.mode, difficulty: match.difficulty,
        startedFromLobby: writer.fromStart, maxBytes: MAX_BYTES,
        provenance: 'Native simulator, not official-game footage; controller is client-declared, not verified human or model identity' });
      snapshot(ps.playerId, 'capture-start');
    }
  } catch (error) {
    for (const writer of writers.values()) closeWriter(writer, 'capture-error');
    warn(error);
    return null;
  }

  function instrument(method, intentFor) {
    const original = match[method];
    if (typeof original !== 'function') return;
    match[method] = function(playerId, ...args) {
      const intent = intentFor(...args);
      const writer = writers.get(playerId);
      const capture = !closed && writer?.fd != null && intent != null;
      let before = null;
      let action = null;
      if (capture) {
        try { before = stateFor(playerId); action = copy(intent); }
        catch (error) { closeWriter(writer, 'capture-error'); warn(error); }
      }
      // Preserve return/exception behavior of the engine; observer errors never replace it.
      let result;
      try {
        result = original.call(this, playerId, ...args);
        return result;
      } finally {
        if (capture && before && action && writer.fd != null) {
          try { emit(writer, { kind: 'action', action, before, after: stateFor(playerId),
            accepted: result?.ok === true, result: result == null ? null : copy(result),
            source: 'human-seat-client-intent' }); }
          catch (error) { closeWriter(writer, 'capture-error'); warn(error); }
        }
      }
    };
  }
  instrument('handle', intent => typeof intent?.t === 'string' && intent.t.startsWith('g.') ? intent : null);
  instrument('setLoadout', (entries, ops) => ({ t: 'room.loadout', entries, ...(ops === undefined ? {} : { ops }) }));
  instrument('requestSetupReroll', setupRevision => ({ t: 'room.rerollSetup', setupRevision }));
  instrument('cancelSetupReroll', voteId => ({ t: 'room.cancelReroll', voteId }));

  for (const method of ['setController', 'onDisconnect', 'onReconnect', 'onLeave']) {
    const original = match[method];
    if (typeof original !== 'function') continue;
    match[method] = function(playerId, ...args) {
      try { return original.call(this, playerId, ...args); }
      finally {
        if (!closed) {
          snapshot(playerId, method);
          // A permanent departure ends this seat's capture, even while teammates continue.
          if (method === 'onLeave') {
            const writer = writers.get(playerId);
            if (writer?.fd != null) closeWriter(writer, 'interrupted');
          }
        }
      }
    };
  }

  const send = match.sendFn;
  match.sendFn = function(playerId, message) {
    const writer = writers.get(playerId);
    if (!closed && writer?.fd != null) {
      try {
        if (message?.t === 'm.private') snapshot(playerId, 'private-update');
        if (message?.t === 'm.result' || message?.t === 'b.end') {
          emit(writer, { kind: 'outcome-message', message: copy(message) });
          if (message.t === 'm.result') writer.resultSeen = true;
        }
      } catch (error) { closeWriter(writer, 'capture-error'); warn(error); }
    }
    return send.call(this, playerId, message);
  };

  const broadcast = match.broadcastFn;
  match.broadcastFn = function(message) {
    if (!closed && message?.t === 'm.public') {
      const key = `${message.round}:${message.phase}`;
      if (key !== phaseKey) {
        phaseKey = key;
        for (const id of writers.keys()) snapshot(id, 'phase-change');
      }
    }
    if (!closed && (message?.t === 'm.result' || message?.t === 'b.end')) {
      for (const writer of writers.values()) {
        try {
          emit(writer, { kind: 'outcome-message', message: copy(message) });
          if (message.t === 'm.result') writer.resultSeen = true;
        } catch (error) { closeWriter(writer, 'capture-error'); warn(error); }
      }
    }
    return broadcast.call(this, message);
  };

  const dispose = match.dispose;
  match.dispose = function(...args) {
    if (!closed) {
      closed = true;
      for (const [id, writer] of writers) {
        snapshot(id, 'dispose');
        closeWriter(writer, match.ended && writer.resultSeen ? 'settled' : 'interrupted');
      }
    }
    return dispose.apply(this, args);
  };
  return { captureId, files: writers.size };
}
