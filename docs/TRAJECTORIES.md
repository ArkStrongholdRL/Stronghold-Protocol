# Local human-seat trajectories

This optional server recorder captures ordinary native-game decisions for later
offline analysis. It is separate from the statistics screen's settlement records
and from test-mode input journals. Test rooms are excluded, because their command
console can change the rules. Battle simulation and normal game rules are unchanged.

## Enable

From the game checkout, after `npm ci` and normal client setup:

```sh
SP_TRAJECTORY_DIR=.cache/trajectories npm start
```

The switch is off when `SP_TRAJECTORY_DIR` is absent/empty. It takes effect for
new matches; restart without it to stop recording. Play normally in the browser.
Each non-bot participant gets one JSONL file, named with a random capture ID and
seat. Files remain on the server, under the directory relative to the server's
working directory. The recommended `.cache/` location is already ignored by Git.
Use this on a server whose participants know their games are being collected.
There is no upload, browser download endpoint, replay player or automatic cleanup.
When enabled, `/trajectory-policy` advertises recording without revealing storage paths.
The browser shows a recording disclosure once per tab session and notice version,
with a persistent “采集与隐私” entry. It explains identifiers, teammate public
information, research/training use, administrator access and deletion requests.
Acknowledgement is session-local UI state, not server-enforced consent or proof
of anonymization. Direct protocol clients can bypass it. There is no opt-out
play mode on this recording server; unwilling visitors should not start a match.
The operator copies selected files from that directory and manages retention.

The header names APP_VERSION, room mode/difficulty, content IDs when present,
the initial controller declaration and LLM involvement flag,
the seat's fixed `diy` mapping `{ [slotBaseId]: { charId, skillIndex, uniEquipId } }`,
and the normalized uint32 master `seed` actually used by Match, once in the header,
and SHA256 of `JSON.stringify(match.data)` (cached once per data object). You may
set `SP_TRAJECTORY_REVISION` to the source revision label for the deployment;
otherwise `codeRevision` is null. That label is operator supplied, not verified
against Git or a dirty checkout. Keep the exact source/deployment manifest with
the dataset; app version alone does not identify every local rule change.

## What is captured

Schema: `stronghold-human-seat-trajectory/v1`, with monotonic `seq` from zero.

| Row | Contents |
| --- | --- |
| `header` | Capture/seat/source identity, version/content/data provenance, master seed, DIY operator resource IDs/skill/module picks and size limit |
| `state` | Authoritative publicView, that seat's privateView, public deployment geometry and connection/autoplay/left flags, at start, phase changes, private updates, disconnect/reconnect/leave and disposal |
| `action` | Client `g.*` or in-match room loadout/setup-reroll/cancel intent, exact before/after views, actual native return and accepted boolean |
| `outcome-message` | Emitted `b.end` or `m.result` data; no engine-internal battle or RNG dump |
| `footer` | Status, row count, checksum of preceding UTF-8 JSONL bytes and completeness flag |

The private view includes shop offers/effective prices, funds, level, hand/temp,
board coordinates/facing/equipment, loadout/ownership settings and public enemy
preview. Other seats' private views, shared stock/RNG internals, handshake tokens
and browser authentication are not captured. Except for the single top-level
`header.seed`, keys naming seed/RNG or the native
transport's unrevealed hiddenBossId are removed recursively. Public result messages can include
other players' names and final lineups. Storage is one file per seat, not an
anonymized dataset. No frame-by-frame combat recording is provided.

Rejected inputs are preserved as rejected. Autoplay-generated purchases are not
labeled as human actions: they do not enter through client intents. Control flags
and engine-driven state updates remain available. A client script can issue the
same intents as a human, so `source: human-seat-client-intents` names a non-bot seat's
transport, not proof of human authorship. `header.controller` records the initial source,
and `state.control.controller` plus `state.control.llmUsed` retain current source and prior
LLM involvement. Source changes produce a state row with reason `setController`. Declarations
are self-reported, not proof of a human or specific model identity. Missing legacy declarations
are unknown. The v1 JSONL envelope remains compatible; identity credentials are not added. Track actual collection provenance separately. Setup ownership
and DIY are fixed from the initial views; pre-match lobby edits are not action rows.

Snapshots contain native views plus a read-only `deployment: { field, cells }`
extension from deployMapFor (coordinates and terrain kinds, not legality probes).
They are not the RL project's versioned observations or
post-history/prep64 candidate labels. Downstream conversion must explicitly map
versions, IDs, map cells and actions, retain unsupported records with reasons,
and split complete games before learning. These are offline trajectories; do not
place their human actions into an on-policy PPO buffer.

`header.diy` identifies the actual operator resource ID (`charId`) selected for
each DIY slot, together with its skill index and module resource ID (`uniEquipId`,
null for none). It is `{}` when no DIY operator is selected. Piece `uid` is only
a match-instance identity; use its `id` plus this slot mapping and the matching
data resources to resolve the operator. Older headers may omit `diy`.

## Integrity and limits

```sh
node tools/trajectory.mjs verify .cache/trajectories
node tools/trajectory.mjs verify .cache/trajectories --require-complete
```

`header.seed` is server-side offline metadata; it is not added to player views,
WebSocket messages, model observations or per-round rows. Older v1 files without
it remain valid and the verifier reports `seed: null`; it must not invent a seed
for them. A seed is necessary but not sufficient for whole-match reproduction:
retain the exact code, data, mode/settings, seat ordering and action/control
history. Shop/draft/meta streams and normal/unite/boss field seeds derive from
the master seed; different decisions or timing/control transitions may diverge.
These seat trajectories do not contain every player's private intents or every
autoplay action, so the addition does not turn them into full-match replay files.

The verifier checks schema, sequence, JSONL termination, footer checksum/status
and basic action/state shape, and reports accepted/rejected moves and actual +1
upgrade transitions. It does not certify strategy quality, human authorship or
candidate compatibility. The checksum detects damage; it is not a signature.

`complete` requires recording from LOBBY, an emitted match result, and normal
disposal. It describes capture coverage, not personal victory. A team result
must still be separated from the recorded player's survival. Mid-match disposal
is `interrupted`; size-limited capture is `truncated`; observer snapshot errors
are `capture-error`. A crash/write failure may leave no footer and is rejected.
Captures never resume across server restarts. A permanent `onLeave` seals that seat’s file as interrupted immediately, even
when teammates continue. Reconnecting to the same running
match continues the same file; browser-disconnected periods are visible in control
flags and may contain engine-managed decisions.

Each file is capped at 64 MiB, with room reserved for a truncation footer. Writes
are synchronous and bounded per file; there is no global disk-retention limit.
Observer I/O failures log a warning and disable the affected capture, preserving
engine return/exception behavior. Operators should allow for disk latency and
space; no claim of zero performance overhead is made. Sandboxed gameplay-plugin
hosts intentionally do not inherit this directory or gain filesystem permissions;
their absence is not an empty successful capture. This iteration validates
ordinary vanilla matches, not every plugin/host transport.
