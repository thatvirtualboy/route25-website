// Every public page uses the same progressive, keyboard-accessible menu.
(() => {
  const header = document.querySelector('.site-header');
  const nav = header?.querySelector('.site-nav');
  const toggle = header?.querySelector('.site-menu-toggle');
  if (!nav || !toggle) return;

  toggle.hidden = false;
  header.classList.add('has-menu');

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
  header.addEventListener('focusout', event => {
    if (!header.contains(event.relatedTarget)) close();
  });
  window.matchMedia('(min-width: 861px)').addEventListener('change', event => {
    if (event.matches) close();
  });
})();
