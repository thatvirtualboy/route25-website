/* Reports dimensions only; never sends the share URL, token, or collection data. */
(() => {
  if (window.parent === window) return;
  const widget = document.querySelector('.widget');
  if (!widget) return;
  let queued = false;
  let lastHeight = 0;
  function schedule(force = false) {
    if (force) lastHeight = 0;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      // Measure content, not the viewport, so a formerly tall iframe can shrink.
      const height = Math.ceil(widget.getBoundingClientRect().height);
      if (height < 1 || height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage({ type: 'route25:embed:resize', version: 1, height }, '*');
    });
  }
  window.addEventListener('message', event => {
    if (event.source === window.parent && event.data?.type === 'route25:embed:measure' && event.data.version === 1) schedule(true);
  });
  new ResizeObserver(() => schedule()).observe(widget);
  window.addEventListener('resize', () => schedule());
  document.addEventListener('load', () => schedule(), true);
  document.fonts?.ready.then(() => schedule());
  schedule();
})();
