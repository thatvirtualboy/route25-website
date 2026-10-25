/* Include once (or alongside each snippet) on the page hosting Route 25 embeds. */
(() => {
  const key = Symbol.for('route25.embedResize');
  if (window[key]) return;
  const script = document.currentScript;
  if (!script?.src) return;
  const origin = new URL(script.src, document.baseURI).origin;
  window[key] = true;
  const selector = 'iframe[data-route25-embed]';

  function embedOrigin(frame) {
    if (!frame.matches(selector)) return null;
    try {
      const url = new URL(frame.getAttribute('src'), document.baseURI);
      return url.origin === origin && /^\/embed\/(trainer|collection)\/[A-Za-z0-9_-]{1,128}\/?$/.test(url.pathname) ? url.origin : null;
    } catch { return null; }
  }
  function measure(frame) {
    const target = embedOrigin(frame);
    if (target) frame.contentWindow?.postMessage({ type: 'route25:embed:measure', version: 1 }, target);
  }
  function measureAll() { document.querySelectorAll(selector).forEach(measure); }

  window.addEventListener('message', event => {
    const data = event.data;
    if (event.origin !== origin || data?.type !== 'route25:embed:resize' || data.version !== 1 ||
        typeof data.height !== 'number' || !Number.isFinite(data.height) || data.height < 1 || data.height > 12000) return;
    for (const frame of document.querySelectorAll(selector)) {
      if (event.source !== frame.contentWindow || embedOrigin(frame) !== event.origin) continue;
      const height = String(Math.ceil(data.height));
      if (frame.getAttribute('height') !== height) frame.setAttribute('height', height);
      if (frame.style.height !== `${height}px`) frame.style.height = `${height}px`;
      break;
    }
  });
  // The child may finish loading before this async script, or be inserted later.
  document.addEventListener('load', event => {
    if (event.target?.matches?.(selector)) measure(event.target);
  }, true);
  document.addEventListener('DOMContentLoaded', measureAll, { once: true });
  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length)) measureAll();
  }).observe(document.documentElement, { childList: true, subtree: true });
  measureAll();
})();
