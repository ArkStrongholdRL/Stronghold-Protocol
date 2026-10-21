// Adapted from xinhai-ai/Stronghold-Protocol, commit e01036ae62acf1be17a118e6a6ef116cbb747b13.
// Distributed under this repository's GPL-3.0-or-later license.
// Runtime art only: bounded, shared requests. Bulk preload and game-data requests
// retain their own integrity, scheduling and combat-pause contracts.
export const ART_IDLE_MS = 30000;
export const ART_REQUEST_MS = 180000;
export const ART_RETRY_MS = Object.freeze([1000, 3000, 8000, 20000]);

export function retryableArtError(error) {
  return error?.name !== 'AbortError'
    && (error?.status == null || [408, 425, 429].includes(error.status) || error.status >= 500);
}

/** Injectable transport for deterministic tests; each attempt owns and aborts its network request. */
export function createArtTransport({
  fetcher = (...args) => globalThis.fetch(...args),
  idleMs = ART_IDLE_MS, requestMs = ART_REQUEST_MS, retryDelays = ART_RETRY_MS,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout,
  concurrency = 4,
} = {}) {
  const pending = new Map();
  const queue = [];
  let active = 0;
  const capacity = () => Math.min(concurrency,
    /^(?:slow-2g|2g|3g)$/.test(globalThis.navigator?.connection?.effectiveType || '') ? 2 : concurrency);
  const pump = () => {
    while (queue.length && active < Math.max(1, capacity())) {
      active++;
      const { run, resolve, reject } = queue.shift();
      Promise.resolve().then(run).then(resolve, reject).finally(() => { active--; pump(); });
    }
  };
  const attempt = async (url) => {
    const controller = new AbortController();
    let idleTimer;
    let totalTimer;
    let reader;
    const timeout = () => controller.abort(new DOMException('Asset download timed out', 'TimeoutError'));
    const touch = () => {
      clearTimer(idleTimer);
      if (idleMs > 0) idleTimer = setTimer(timeout, idleMs);
    };
    touch();
    if (requestMs > 0) totalTimer = setTimer(timeout, requestMs);
    try {
      const response = await fetcher(url, { mode: 'cors', credentials: 'omit', signal: controller.signal,
        ...(/\.json(?:[?#]|$)/i.test(url) ? { cache: 'no-cache' } : {}) });
      if (!response.ok) {
        await response.body?.cancel?.().catch(() => {});
        throw Object.assign(new Error(`Asset HTTP ${response.status}`), { status: response.status ?? 0 });
      }
      const type = response.headers?.get?.('content-type') || '';
      if (!response.body?.getReader) return await response.blob();
      reader = response.body.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength) { chunks.push(value); touch(); }
      }
      return new Blob(chunks, { type });
    } catch (error) {
      if (reader) await reader.cancel(error).catch(() => {});
      // A timeout is retryable, unlike an explicit cancellation.
      throw controller.signal.aborted ? controller.signal.reason : error;
    } finally {
      clearTimer(idleTimer);
      clearTimer(totalTimer);
      reader?.releaseLock();
    }
  };
  const download = async (url, priority) => {
    for (let n = 0; ; n++) {
      try {
        // A retry backoff does not occupy a scarce network slot.
        return await new Promise((resolve, reject) => {
          queue.push({ run: () => attempt(url), resolve, reject, priority });
          queue.sort((a, b) => b.priority - a.priority);
          pump();
        });
      } catch (error) {
        if (n >= retryDelays.length || !retryableArtError(error)) throw error;
        await wait(retryDelays[n] * (0.8 + random() * 0.4));
      }
    }
  };
  return {
    blob(url, { priority = 1 } = {}) {
      const key = new URL(url, globalThis.location?.href || globalThis.location?.origin || 'http://localhost').href;
      if (!pending.has(key)) {
        const promise = download(url, priority).finally(() => pending.delete(key));
        pending.set(key, promise);
      }
      return pending.get(key);
    },
    has(url) {
      return pending.has(new URL(url, globalThis.location?.href || globalThis.location?.origin || 'http://localhost').href);
    },
  };
}

export const artTransport = createArtTransport();

/** Decode downloaded art without a second HTTP request. Revoke the temporary URL on every exit path. */
export async function loadRuntimeImage(url) {
  const blob = await artTransport.blob(url, { priority: 2 });
  const temporary = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      const finish = (error) => {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (error) { image.src = ''; reject(error); } else resolve(image);
      };
      const timer = setTimeout(() => finish(new Error(`Image decode timeout: ${url}`)), ART_IDLE_MS);
      image.onload = () => finish(null);
      image.onerror = () => finish(new Error(`Image decode failed: ${url}`));
      image.src = temporary;
    });
  } finally { URL.revokeObjectURL(temporary); }
}

const pixiParsers = new WeakSet();
/** Keep Pixi's parsing/texture ownership; replace only its runtime-art network reads, never global fetch/ADAPTER. */
export function installArtParsers(PIXI) {
  for (const parser of PIXI?.Assets?.loader?.parsers || []) {
    if (!parser.load || pixiParsers.has(parser)) continue;
    const original = parser.load;
    parser.load = async function (url, options, loader) {
      const path = new URL(url, globalThis.location?.origin || 'http://localhost').pathname;
      if (!/\/assets\/.*\.(?:skel|atlas|png|jpe?g|webp|gif|avif)$/i.test(path)) {
        return original.call(this, url, options, loader);
      }
      const blob = await artTransport.blob(url);
      if (/\.skel$/i.test(path)) return blob.arrayBuffer();
      if (/\.atlas$/i.test(path)) return blob.text();
      const temporary = URL.createObjectURL(blob);
      try {
        // Pixi's bitmap path fetches blob: again (sometimes in a Worker), which the site's
        // connect-src 'self' intentionally blocks. Use its Image path for this invocation only.
        const context = this.config ? { ...this, config: { ...this.config, preferCreateImageBitmap: false } } : this;
        const texture = await original.call(context, temporary, options, loader);
        if (texture?.baseTexture?.resource) texture.baseTexture.resource.src = url;
        // Pixi's original loadTextures registered cleanup against the temporary
        // URL. Also remove the original identity on destruction.
        const clear = () => {
          delete loader.promiseCache[url];
          if (PIXI.Assets.cache?.has?.(url)) PIXI.Assets.cache.remove(url);
        };
        texture?.once?.('destroyed', clear);
        texture?.baseTexture?.once?.('destroyed', clear);
        return texture;
      } finally { URL.revokeObjectURL(temporary); }
    };
    pixiParsers.add(parser);
  }
}
