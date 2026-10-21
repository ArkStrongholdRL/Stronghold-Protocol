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
2. Back up the deployed `public/index.html`.
3. Copy `.cache/client-build/index.html` to a temporary sibling of the deployed
   index and atomically rename it over `public/index.html`.
4. Verify the homepage, game connection and an actual battlefield.

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
Simulator modules and Worker entrypoints keep their original endpoints and CSP.

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
and automatic priority. This is not a global model-download scheduler or an image
transcoding pipeline. CDN/origin cache configuration is separate.

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
