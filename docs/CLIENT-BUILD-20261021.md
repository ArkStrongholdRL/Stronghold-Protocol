# Production client build — 2026-10-21

## Scope

The public game now uses an optional esbuild production client. `public/index.html`
remains the source/development entry. `npm run build:client` writes only the
regenerable `.cache/client-build/` directory (replaces its earlier output).
Deploy its assets under `public/build/assets/`, then atomically publish the
built index.html as the production public/index.html. Upload assets before HTML;
retain previous hashed assets so already-open pages can finish lazy imports.
No generated bundles, game art or execution records belong in source control.

Build inputs: 243 JS modules → 20 ESM files, including dynamically imported
renderer/plugin modules; 21 source CSS files → one minified CSS file. All JS
outputs total about 1.78 MB before HTTP compression (not initial-page traffic).
Static entry dependencies are modulepreloaded; renderer remains a dynamic import
warmed on lobby/room entry by the earlier fieldEngine fix. Esbuild's splitting
shares module instances (one Preact implementation and one hooks module), avoiding
separate UI/renderer copies of stores, language or cosmetics state.

The build rewrites import.meta.url references to original browser source URLs:
Worker entrypoints, dynamic simulator/trait loaders, SDK-relative URLs and
plugin sandbox paths keep their original addresses. Simulator entrypoints and
workers remain external source modules, with the existing worker CSP. No server
or simulator source/engine/data/reward changes were made by this deployment.
Plugin/content-set variants beyond vanilla were not exercised in the manual run.

Hashed output names and matching ?v= values use the existing static server's
immutable cache policy: public,max-age=31536000,immutable. Source JS, HTML and
mutable JSON keep their existing revalidation policy. No blanket long-cache rule
was added. Compression remains the existing HTTP gzip/brotli implementation.

Current shop portraits, current shop item icons and player avatars use eager
loading, high fetch priority and asynchronous decoding. Other Img users remain
lazy/automatic priority. This does not compress/resize downloaded upstream art,
implement a global model scheduler, add CDN service, or add new loading-screen
strings. Those remain separate possible follow-ups.

## Deployment and rollback

Host: Huawei, current release /opt/stronghold/releases/7600e202868d, existing
127.0.0.1:3000 service and Tencent/FRP entrance. Published main is
main-42UQY44A.js, styles-a74e9fa82c943f51.css. Built index SHA256:
5ccc1bd353254596d719d1619fabd7afc8111d95595aa5cde5930afb42891e72.

The original production index is at
/opt/stronghold/frontend-backups/build-20261021/index.original.html.
Rollback: copy it to a temporary sibling of public/index.html and atomically
rename it over index.html; leave build/assets files available to existing pages.
The server was not restarted, so its cached build fingerprint is unchanged.
Players reload to adopt the new entry. Existing matches retain their current JS.
Only built assets and index were published; backend and mutable raw source paths
remain as before. Local source changes/package lock/build tool are preserved in
the separate Stronghold-Protocol checkout for the next full release.

## Verification performed

- Node syntax, targeted ESLint for build tool/shop module and git diff --check.
  gameComponents has one pre-existing unused import warning. No tests added/run.
- Generated chunk imports resolve to generated files and carry immutable URLs.
- All 243 input hashes compared to production source: only the intended Img/shop
  priority source edits differ, preventing accidental inclusion of unrelated
  local modifications. Existing trajectory/privacy and preload fixes are included.
- Public HTTP verified the built entry and immutable caching on a generated JS.
- Browser preview: homepage, lobby, solo briefing/strategy, normal battlefield,
  shop confirmation/purchase (funds 4→2), battle startup and progression. No new
  renderer/Worker errors were logged; missing BGM/voice HTTP 404s predate the build.
- The initial preview build was followed by a module-URL preservation correction
  for parenthesized import.meta; final entry is checked separately after publish.
- This is functional verification, not a controlled cold-cache speed benchmark.
  Resource download through the origin/FRP remains a limitation pending CDN/cache.

Final production verification: the root page's #sp-main points to
/build/assets/main-42UQY44A.js?v=42UQY44A, and screen styles load from the
single hashed CSS. Entering the lobby succeeded, with no console errors. The
preview diagnostic match was explicitly abandoned. Screenshot saved outside
the repository. No controlled cold-cache benchmark is claimed.


## Runtime-loading follow-up published (2026-10-21)

The organization fork change e9d1cac8 was built with this deployment's existing
trajectory/privacy notice and stylesheet. The deployment payload contains 40 files:
the generated assets and index, the runtime art service worker, matching source
fallback modules and merged language entries. No server, engine source, game data
or process was replaced/restarted.

Published at 2026-10-21 03:42:54 UTC (11:42:54 CST), same Huawei release
`/opt/stronghold/releases/7600e202868d`. Main: `main-SCSZWJMW.js`; simulation:
`simulation-70ee47d77ed39471.js`. Public index SHA256:
`dbd7c2c62ebe4d69e1f727f754cb71d77e4088e7a9a6f858e588d15de6e6d60f`.
Public HTTP checks match the payload bytes for index, sw.js, main, simulation and
resourceNetwork.js. Index/SW/source modules revalidate; versioned generated assets
have one-year immutable caching. Health uptime and vanilla content identity remain
unchanged, apart from elapsed time.

Backup and rollback helper on Huawei:
`/opt/stronghold/frontend-backups/loading-e9d1cac8-20261021T034254Z/rollback.py`.
To restore the prior frontend, run that script with Python 3 on Huawei. It checks
the current release, restores the old index/SW/source files atomically per file,
keeps new hashed assets available for already-open tabs, and does not restart the
server. The backup also contains the deployment and previous-file manifests.

The public browser replay retained the privacy notice, entered solo standard,
loaded the textured battlefield and enemy models, purchased an operator (4 to 2
funds), and started combat without new error logs. Existing missing BGM files
still produce 404 warnings. This is functional verification, not a controlled
cold-start benchmark; no speedup percentage is claimed.

Final public replay reached round 2 with no error-level console entries. The
storage dialog showed 98 cached files (about 3.8 MB origin storage), confirming
on-demand writes on the public origin. The diagnostic match was explicitly
abandoned after verification; no pre-existing room was altered. Screenshot:
`/Users/harco/Programs/Stronghold-Protocol-client-loading/.cache/client-loading-live-20261021.png`.
