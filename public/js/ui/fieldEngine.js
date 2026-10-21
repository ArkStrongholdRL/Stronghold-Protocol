// Share the early renderer import with the eventual field mount. Warming never creates a canvas.
let enginePromise = null;
let warmPromise = null;

export function loadFieldEngine() {
  if (!enginePromise) {
    const pending = import('../render/app.js');
    enginePromise = pending;
    pending.catch(() => { if (enginePromise === pending) enginePromise = null; });
  }
  return enginePromise;
}

export function warmFieldEngine() {
  if (globalThis.__SP_RENDER__ === 'fallback'
    || new URLSearchParams(globalThis.location?.search || '').get('render') === 'fallback') return Promise.resolve();
  if (!warmPromise) {
    const pending = loadFieldEngine().then((mod) => mod.ensurePixi());
    warmPromise = pending;
    pending.catch(() => { if (warmPromise === pending) warmPromise = null; });
  }
  return warmPromise;
}
