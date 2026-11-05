// A consistent, keyboard-accessible menu for the public page templates.
(() => {
  if (!document.body.classList.contains('public-page')) return;
  const header = document.querySelector('.topbar-inner, .newsletter-header');
  const nav = header?.querySelector('nav');
  if (!nav) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'public-menu-toggle';
  toggle.textContent = 'Menu';
  toggle.setAttribute('aria-expanded', 'false');
  nav.id = 'public-navigation';
  nav.setAttribute('aria-label', 'Primary');
  toggle.setAttribute('aria-controls', nav.id);
  nav.before(toggle);
  document.body.classList.add('public-nav-ready');

  function close() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('click', event => {
    if (!nav.contains(event.target) && !toggle.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      close();
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 721px)').addEventListener('change', event => {
    if (event.matches) close();
  });
})();
