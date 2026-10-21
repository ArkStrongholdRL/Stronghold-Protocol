# LLM source marker deployment — 2026-10-21

Runtime revision: `c3a4bd70`, organization fork branch
`codex/collect-human-trajectories`. Includes the existing trajectory recorder,
privacy notice and merged client-loading work. LLM declarations remain metadata;
bots, game rules and authentication are unchanged.

Huawei staged release: `/opt/stronghold/releases/c3a4bd70`.
Previous release: `/opt/stronghold/releases/7600e202868d`.
Production remains on the previous release until all matches finish, as requested
by the operator. The transient systemd timer `stronghold-pending-update.timer`
checks once per minute. `/opt/stronghold/activate-pending.py` checks `/healthz`
for zero matches twice, atomically switches `current`, restarts the service,
and rolls back if the new service fails its health/content check. It stops its
timer after success or rollback. It does not block players starting new matches.
Disconnected retained matches also delay activation. This transient timer does
not survive a server reboot; inspect the pending status before rescheduling.

Inspect activation: `/opt/stronghold/pending-update-status.json`,
`systemctl status stronghold-pending-update.timer`, and
`journalctl -u stronghold-pending-update.service`.
Cancel pending activation: `systemctl stop stronghold-pending-update.timer`.
After activation, manual rollback switches `current` back to the previous release
and restarts `stronghold.service` (only after checking for active matches).

Staging preserves prior hashed client assets, vendor/runtime dependencies and
persistent art/cache/recording links. Generated entry: `main-WCT5CP7E.js`.
Built simulation asset remains `simulation-70ee47d77ed39471.js`.
The source content manifest changes with the additional shared controller module:
new vanilla identity `bbda021bb2c914cf70e0fce8549c169a0426148dd06651b76230278c38dcc64a`.
A separate loopback-port server under the production Unix user returned healthy
with this identity; the live process was not restarted for verification.

Validation: 117 protocol/lobby/controller/host/docs checks, 625 browser-client
checks, all language packs, 298 unchanged golden scenarios, production build,
TypeScript and smoke pass. ESLint has zero errors (149 warnings).
The import checker still reports the three existing Node-only imports in
`server/sim/nodeData.js`, also noted in the earlier renderer deployment record.
The original full-suite invocation includes the old hello-field expectation;
that expectation was fixed and all 625 browser-client checks rerun successfully.
