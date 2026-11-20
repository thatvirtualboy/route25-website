(() => {
  for (const img of document.querySelectorAll('.giveaway-art img')) {
    const fallback = () => {
      const label = document.createElement('span'); label.className = 'artwork-fallback';
      label.textContent = img.alt || 'Prize photo unavailable'; img.replaceWith(label);
    };
    img.addEventListener('error', fallback, {once: true});
    if (img.complete && !img.naturalWidth) fallback();
  }
  const print = document.querySelector('[data-print]');
  if (print) { print.hidden = false; print.addEventListener('click', () => window.print()); }
  // Use the API clock, not the visitor's device clock (also supports staging).
  const refreshAfter = Number(document.body.dataset.refreshAfter);
  if (Number.isFinite(refreshAfter) && refreshAfter > 0) setTimeout(() => window.location.reload(), Math.min(refreshAfter, 2147483647));
  // Reload after a tab was left open so closed entry windows do not look active.
  let hiddenAt;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 60000) window.location.reload();
  });
})();
