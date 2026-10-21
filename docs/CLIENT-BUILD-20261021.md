# Optional production client build

Run with Node 22+ and development dependencies installed:

```sh
npm ci
npm run build:client
```

The build replaces the regenerable `.cache/client-build/` output directory.
Source `public/index.html` remains the development entry. No game assets are
bundled or copied. Generated output stays ignored and must not be committed.

## Publishing

1. Copy `.cache/client-build/assets/` into the deployment's
   `public/build/assets/` directory. Keep older hashed files for open tabs.
2. Publish `public/sw.js` from this release with revalidation (`Cache-Control: no-cache`).
   Keep the matching source modules available for source-mode/plugin fallbacks; use
   the complete intended release when deploying, rather than mixing engine versions.
3. Back up the deployed `public/index.html`.
4. Copy `.cache/client-build/index.html` to a temporary sibling of the deployed
   index and atomically rename it over `public/index.html`.
5. Verify the homepage, game connection, an actual battlefield and runtime cache writes.

To roll back, atomically restore the saved index. Leave generated assets available
for pages that already loaded them. Do not overwrite source-checkout index.html
when preparing future builds. Existing pages use their loaded code until reload;
follow the normal deployment/build-guard process for the site. A frontend-only
index swap does not require interrupting matches or restarting the game process,
but its process-cached build tag will not change until a subsequent restart.

## Loading behavior

The builder uses one ESM splitting graph for the UI and dynamic renderer, keeping
shared stores, cosmetics, language, Preact and hooks as shared module instances.
Screen styles are merged in original order. Static entry dependencies are
modulepreloaded; dynamic renderer/plugin chunks remain lazy. Import-meta source
URLs are preserved for Worker entries, trait runtimes and plugin SDK paths.
The built-in simulator becomes a separate lazy asset, reused by the page and the
vanilla AI rehearsal Worker. Their state remains isolated by Worker realm. Engine
and data downloads overlap. Script plugins and hash-pinned operator traits retain
the source module graph; the sandbox simulation Worker keeps its endpoint and CSP.
The build resolves the finite guarded content imports, removes only the Node data
initializer in the generated browser copy and rejects Node-only data loading.
The server simulation source and its content identity are unchanged.

Output filenames contain content-derived build hashes. Generated chunk references
and the stylesheet use version query parameters, taking advantage of the existing
static server's immutable caching. Mutable source files, JSON and HTML retain
revalidation. HTTP compression uses the existing server implementation.

Entering the lobby, joining a room, or restoring a session warms the renderer
import and Pixi/Spine without creating a canvas. Field mounting overlaps the
engine import and asset-store import. Existing 12-second deadlines remain. A
late successful import triggers bounded automatic recovery from simplified view
in PREP; if combat is active it waits for PREP. Cancellation prevents an abandoned
mount from retrying. Explicit fallback mode skips warming and late-import recovery.

Current shop portraits, shop item icons and player avatars load eagerly with
high fetch priority and async decoding; other image components keep lazy loading
and automatic priority. Priority UI art now shares a bounded download queue with asset-store images and
Pixi Spine files: current shop/player images priority 3, board images priority 2,
Spine files priority 1. Downloads default to four concurrent requests (two when
Network Information reports 2G/3G), share in-flight URLs and retry transient
failures with backoff. They use 30-second idle and 180-second per-attempt timeouts.
Spine-store timeouts now allow 180 seconds and view remounts share a healthy load.
Pixi retains texture ownership and destruction; its Image decoder handles downloaded
Blob URLs without adding blob: to connect-src or replacing global fetch.
This does not transcode images or schedule every browser/network request.
CDN/origin cache configuration is separate.

## Verification and limitations

The published site with the earlier deployment overlay was manually checked for
homepage/lobby, solo briefing and strategy, normal battlefield rendering, purchase
confirmation/funds updates, battle startup and progression. No new renderer or
Worker errors were observed. The isolated branch is also built from a fresh
npm installation and checked for generated dependency URLs and shared Preact input.
Node syntax, targeted ESLint and diff whitespace checks are used; no automated
tests or fixtures were added or run for this task. Existing missing media files
are not repaired by the build. No controlled cold-start speedup is claimed.

The actual source/deployment entry differs from installations carrying unrelated
local patches. Always build the source of the intended release. Plugin/content
set variants beyond vanilla and all browsers have not been exercised here.

Isolated branch verification: fresh `npm ci --ignore-scripts`, `npm run vendor`
and `npm run build:client` succeeded. The clean-source build has 242 inputs and
20 JS outputs (the deployed overlay has one additional privacy-notice module).
Existing dependency lock entries remain unchanged; only esbuild and its platform
binaries were added. Targeted ESLint has no errors and reports two pre-existing
warnings in main.js/gameComponents.js. Generated imports and original module URLs
were checked. This branch's artifact hashes differ from the deployed overlay,
so the published artifact names are intentionally not pinned in this guide.

## On-demand persistent art cache

The existing classic `/sw.js` still reads imported packs first. A miss checks a
separate `sp-runtime-assets-v1` cache, then the network. Only same-origin,
content-hashed `/assets/~<16 hex>/...` and `/fonts/~<16 hex>/...` art/font files
are saved on demand. Successful complete responses only; no-store/private, Vary *,
audio, Range, code, game data, APIs and WebSockets are excluded. Unhashed URLs keep
normal HTTP caching. This requires no Cloudflare services.

Runtime cache limits are 96 MiB, 512 files and 8 MiB per file (FIFO eviction),
independent of imported packs. Writes are serialized, limited to eight pending
bodies and fail open on storage errors. Metadata is scanned once per worker
lifetime. Existing import-storage counting includes runtime art, excluding duplicate
paths, and clearing imported storage also clears the runtime cache. Old file hashes in the runtime
cache naturally age out under the size limit; this is not a complete offline
resource pack. First visits still download required art; the cache mainly benefits
later visits. The existing full-download dialog pauses on close/unmount, so it
does not continue downloading in a match. No new background preload was added.

The runtime transport is adapted from xinhai-ai/Stronghold-Protocol commit
`e01036ae62acf1be17a118e6a6ef116cbb747b13`, under GPL-3.0-or-later, with local
priority and CSP adaptations. No gameplay, worker-pool or Redis changes were ported.

## Follow-up validation (2026-10-21)

The production build has 23 UI/renderer JS outputs, one 1,248,574-byte lazy engine
and an 838-byte AI rehearsal Worker (uncompressed). These are artifact counts and
sizes, not measured speedup. The engine module was loaded with generated game data
and its BattleSpec exports compared with the source exports. An initial manual
load exposed unresolved guarded content imports; the build now makes them explicit.
A browser check also exposed Pixi's second Blob fetch under CSP; the per-invocation
Image path resolved it without changing CSP.

A localhost preview served the built client and local game, proxying real art from
the existing site. Manual checks reached the battlefield, showed enemy Spine models
and shop portraits, purchased an operator (funds 4 to 2), started combat and reached
round 2. No new error logs appeared after the texture fix; existing BGM 404s remain.
This proxy setup is not a representative cold-start benchmark. Plugin variants,
Safari, cache eviction at the size limit and multi-tab clearing are not yet manually
exercised. No automated tests, fixtures or infrastructure were added.

Targeted ESLint reports zero errors and three existing warnings. The existing
`node tools/check-imports.mjs` command reports three `sim-node` violations in the
unchanged `server/sim/nodeData.js` (`node:fs`, `node:path`, `node:url`); it is not a
clean validation result. The browser build independently rejects nodeData.js and
its generated engine module loads without Node imports. No engine source was edited.

The preview stored 190 on-demand files (about 8 MB total origin storage) without
importing a pack. The storage dialog displayed them after reload; its clear action
returned the count to zero. Clearing copy now explicitly includes both imported
and automatically cached art, translated in all four language packs.

The final engine build additionally rejects every external module dependency,
preventing filesystem source paths or unbundled loaders from leaking into browser
output. Its metadata contains 313 source modules, no nodeData.js/server/data.js and
no external dependencies. A second manual game used the corrected self-contained
asset; the preview server code-request counter rose by only seven across reload
and entering the game, rather than loading the source engine graph again.
