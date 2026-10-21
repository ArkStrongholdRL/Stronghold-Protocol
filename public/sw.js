// Classic service worker for imported art and bounded on-demand immutable art caching.
// Keep these three lines in sync with public/js/assetCache.js (that module documents why this file is not a module).
const IMPORTED_ASSET_CACHE = 'sp-imported-assets-v1';
const IMPORTED_ASSET_CACHE_PREFIX = 'sp-imported-assets-';
const RUNTIME_ASSET_CACHE = 'sp-runtime-assets-v1';
const RUNTIME_MAX_BYTES = 96 * 1024 * 1024;
const RUNTIME_MAX_FILE = 8 * 1024 * 1024;
const RUNTIME_MAX_FILES = 512;
let writes = Promise.resolve(), pendingWrites = 0, runtimeSizes = null, runtimeGeneration = 0;
const IMPORTED_ASSET_PATH = /^\/(?:assets|fonts|media)\/~[0-9a-f]{16}\//;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(IMPORTED_ASSET_CACHE_PREFIX) && name !== IMPORTED_ASSET_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const generation = runtimeGeneration;
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  if (!IMPORTED_ASSET_PATH.test(url.pathname)) return;
  event.respondWith((async () => {
    const key = url.origin + url.pathname;
    // Storage may be blocked or full. Network loading must still work.
    try {
      const imported = await caches.open(IMPORTED_ASSET_CACHE);
      const hit = await imported.match(key);
      if (hit) return hit;
      const runtime = await caches.open(RUNTIME_ASSET_CACHE);
      const saved = await runtime.match(key);
      if (saved) return saved;
    } catch { /* storage is optional */ }
    const response = await fetch(request);
    // Only immutable art/fonts, never code, game data, APIs or audio/Range responses.
    if (/^\/(?:assets|fonts)\//.test(url.pathname)
      && /\.(?:png|jpe?g|webp|gif|avif|svg|skel|atlas|obj|bin|json|woff2?|ttf|otf)$/i.test(url.pathname) && response.status === 200
      && !/(?:no-store|private)/i.test(response.headers.get('cache-control') || '')
      && response.headers.get('vary') !== '*' && pendingWrites < 8) {
      const copy = response.clone();
      pendingWrites++;
      const save = writes.then(async () => {
        if (generation !== runtimeGeneration) return;
        const body = await copy.blob();
        if (generation !== runtimeGeneration) return;
        if (!body.size || body.size > RUNTIME_MAX_FILE) return;
        const headers = new Headers(copy.headers);
        // Fetch has already decoded transfer compression; account for actual stored bytes.
        headers.delete('content-encoding');
        headers.set('content-length', String(body.size));
        const runtime = await caches.open(RUNTIME_ASSET_CACHE);
        await runtime.put(key, new Response(body, { status: 200, headers }));
        if (!runtimeSizes) {
          runtimeSizes = new Map();
          for (const old of await runtime.keys()) {
            const entry = await runtime.match(old);
            runtimeSizes.set(old.url, Number(entry?.headers.get('content-length')) || RUNTIME_MAX_FILE);
          }
        }
        // Cache metadata is read once per worker lifetime, not once for every downloaded image.
        runtimeSizes.set(key, body.size);
        let size = [...runtimeSizes.values()].reduce((sum, bytes) => sum + bytes, 0);
        for (const [old, bytes] of runtimeSizes) {
          if (size <= RUNTIME_MAX_BYTES && runtimeSizes.size <= RUNTIME_MAX_FILES) break;
          await runtime.delete(old);
          runtimeSizes.delete(old);
          size -= bytes;
        }
      }).catch(() => {}).finally(() => { pendingWrites--; });
      writes = save;
      event.waitUntil(save);
    }
    return response;
  })());
});

// Serialize explicit clearing after pending writes so old downloads cannot immediately resurrect the cache.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'clear-runtime-assets') return;
  runtimeGeneration++;
  const clear = writes.then(async () => {
    await caches.delete(RUNTIME_ASSET_CACHE);
    runtimeSizes = null;
    event.ports[0]?.postMessage({ ok: true });
  }).catch(() => { event.ports[0]?.postMessage({ ok: false }); });
  writes = clear;
  event.waitUntil(clear);
});
