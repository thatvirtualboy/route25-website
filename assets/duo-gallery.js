(() => {
  const gallery = document.querySelector('[data-duo-gallery]');
  if (!gallery) return;

  const slides = [...gallery.querySelectorAll('.duo-slide')];
  const selectors = [...gallery.querySelectorAll('[data-duo-select]')];
  const controls = gallery.querySelector('[data-duo-controls]');
  const playback = gallery.querySelector('[data-duo-playback]');
  const icon = gallery.querySelector('[data-duo-icon]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let playing = !motion.matches;
  let visible = false;
  let timer = null;

  function show(index) {
    current = index;
    slides.forEach((slide, i) => { slide.hidden = i !== index; });
    selectors.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  }

  function syncPlayback() {
    window.clearTimeout(timer);
    timer = null;
    gallery.dataset.playing = String(playing);
    icon.textContent = playing ? 'Ⅱ' : '▶';
    playback.setAttribute('aria-label', playing ? 'Pause iPhone Duo slideshow' : 'Play iPhone Duo slideshow');
    if (playing && visible && !document.hidden) {
      timer = window.setTimeout(() => {
        show((current + 1) % slides.length);
        syncPlayback();
      }, 6500);
    }
  }

  function selectManually(index) {
    playing = false;
    show(index);
    syncPlayback();
  }

  selectors.forEach((button, index) => {
    button.addEventListener('click', () => selectManually(index));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % slides.length;
      if (event.key === 'ArrowLeft') next = (index + slides.length - 1) % slides.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = slides.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        selectManually(next);
        selectors[next].focus();
      }
    });
  });
  playback.addEventListener('click', () => {
    playing = !playing;
    syncPlayback();
  });
  gallery.addEventListener('focusin', event => {
    if (playback.contains(event.target)) return;
    playing = false;
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  motion.addEventListener('change', () => {
    if (motion.matches) playing = false;
    syncPlayback();
  });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.2;
    if (visible) gallery.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    syncPlayback();
  }, { threshold: [0, 0.2] });
  observer.observe(gallery);
  controls.hidden = false;
  syncPlayback();
})();
