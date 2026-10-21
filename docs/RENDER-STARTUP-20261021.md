# Renderer startup repair — 2026-10-21

The public site reproduced `render engine import timed out`, followed by
SIMPLIFIED VIEW. The 12-second import deadline expired before createFieldView.

Changes: public/js/ui/fieldEngine.js shares a pending renderer import; main.js
warms it and Pixi/Spine on lobby entry, room entry and restored-session boot;
fieldHost.js overlaps the import with asset-store setup and recovers after a
late successful import, only in PREP. Explicit fallback skips warming. Existing
timeouts and bounded retries remain. No simulation or research contracts change.

Deployment: three frontend files updated atomically per file on the existing
Huawei release /opt/stronghold/releases/7600e202868d, through the existing public
ark.minyako.top entrance. The process was not restarted because matches were
active. Original main.js and fieldHost.js are saved as *.original.js under
/opt/stronghold/frontend-backups/render-20261021. Rollback restores those two
files (the unused helper can remain). Existing pages need a reload; the process
build tag is cached until a future restart. Assets and sessions were untouched.

Validation: Node syntax checks, targeted ESLint (no new warnings; main.js has
a pre-existing unused eslint-disable), git diff --check and public URL SHA256
comparison passed. Existing import-boundary checker reports three unrelated
node: imports in server/sim/nodeData.js. No automated tests were added or run.

This is a preload/recovery fix, not a bundling/cache-policy change. A single
browser replay cannot establish cold-cache timings across devices or networks.

Public browser replay: a fresh tab entered solo standard simulation and selected
Warfarin. At the observation 6.73 seconds after confirmation the engine canvas
was mounted; a subsequent screenshot showed the textured 3D field. No field
import/init warnings were logged. Existing BGM HTTP 404 warnings remain. Browser
cache was not cleared, so this is functional verification, not a cold-start
benchmark. The diagnostic match was abandoned after capture.


## First visit in a new Safari private window

A newly created private window visited the site for the first time (no remembered
callsign). This isolates normal browsing cache/storage; no normal profile was
cleared. OS DNS/TLS and server caches were not reset. Manual UI observations:
- By 9.54 s after navigation, the title/privacy screen was visible.
- At 5.35 s after strategy confirmation, the strategy button remained disabled.
- At 8.56 s, the engine canvas and prep controls were present.
- At 16.60 s, a screenshot confirmed the textured 3D board, but shop portraits
  and player/effect avatars were still blank.
- At 28.33 s, the visible shop portraits, avatars and enemy previews had filled.
These are observation timestamps/upper bounds, not performance-event timings.
Lobby-to-strategy interaction took about 28.7 s, allowing the intended preload
to run; do not report 8.56 s as the total uncached renderer download time.
Displayed latency briefly reached 6023 ms, later returning to about 90–144 ms.
No simplified fallback was observed; visual cold loading remains slow. The
diagnostic solo game was abandoned and return to lobby was verified.
