(() => {
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('#site-nav');
  function closeMenu() { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
  toggle.addEventListener('click', () => { const open = nav.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', String(open)); });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => { if (!nav.contains(event.target) && !toggle.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); toggle.focus(); } });
  window.addEventListener('resize', () => { if (window.innerWidth > 720) closeMenu(); });
  const tour = document.querySelector('[data-feature-tour]');
  if (!tour) return;

  const tabs = [...tour.querySelectorAll('[role="tab"]')];
  const panels = tour.querySelector('.feature-panels');
  const playback = tour.querySelector('[data-tour-toggle]');
  const playbackIcon = tour.querySelector('[data-tour-icon]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 8000;
  let current = 0;
  let elapsed = 0;
  let playing = !motion.matches;
  let visible = false;
  let frame = null;
  let lastTime = null;

  function canAdvance() {
    return playing && visible && !document.hidden;
  }

  function renderProgress() {
    tour.style.setProperty('--tour-progress', String(elapsed / duration));
  }

  function activate(index, focus = false) {
    current = index;
    elapsed = 0;
    renderProgress();
    tabs.forEach((item, itemIndex) => {
      const active = itemIndex === index;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
    });
    if (focus) tabs[index].focus();
  }

  function tick(time) {
    frame = null;
    if (!canAdvance()) return;
    if (lastTime !== null) elapsed += time - lastTime;
    lastTime = time;
    if (elapsed >= duration) activate((current + 1) % tabs.length);
    renderProgress();
    frame = window.requestAnimationFrame(tick);
  }

  function syncPlayback() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    playbackIcon.textContent = playing ? 'Ⅱ' : '▶';
    playback.setAttribute('aria-label', playing ? 'Pause feature tour' : 'Play feature tour');
    playback.setAttribute('title', playing ? 'Pause feature tour' : 'Play feature tour');
    tour.dataset.playing = String(playing);
    if (canAdvance()) frame = window.requestAnimationFrame(tick);
  }

  function selectManually(index, focus = false) {
    playing = false;
    activate(index, focus);
    syncPlayback();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectManually(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        selectManually(next, true);
      }
    });
  });

  // Keyboard readers keep control of the content they are navigating.
  tour.addEventListener('focusin', event => {
    if (playback.contains(event.target)) return;
    playing = false;
    syncPlayback();
  });
  playback.addEventListener('click', () => {
    playing = !playing;
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  motion.addEventListener('change', () => {
    if (motion.matches) playing = false;
    syncPlayback();
  });

  // Keep the current slide and elapsed time when the visitor scrolls away.
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.2;
    if (visible) {
      panels.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    }
    syncPlayback();
  }, { threshold: [0, 0.2] });
  observer.observe(panels);
  playback.hidden = false;
  syncPlayback();
})();
