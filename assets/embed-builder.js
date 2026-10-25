(() => {
  const form = document.querySelector('#embed-form');
  const link = document.querySelector('#share-link');
  const error = document.querySelector('#embed-error');
  const result = document.querySelector('#embed-result');
  const code = document.querySelector('#embed-code');
  const preview = document.querySelector('#embed-preview');
  const status = document.querySelector('#copy-status');
  function update(event) {
    event?.preventDefault(); error.textContent = ''; status.textContent = ''; result.hidden = true; preview.removeAttribute('src');
    try {
      const input = new URL(link.value.trim());
      if (input.protocol !== 'https:' || !['route25.app','www.route25.app'].includes(input.hostname) || input.username || input.password || input.port) throw new Error('Paste a Route 25 profile or collection share link.');
      const match = input.pathname.match(/^\/(trainer|collection)\/([A-Za-z0-9_-]{1,128})\/?$/);
      if (!match) throw new Error('Use a profile link (/trainer/…) or a collection share link (/collection/…).');
      const [, kind, id] = match;
      const token = input.searchParams.get('token');
      if (kind === 'collection' && !/^[A-Za-z0-9_-]{24,128}$/.test(token || '')) throw new Error('This collection link is missing its share token. Copy the full link from Share Collection in the app.');
      const url = new URL(`/embed/${kind}/${id}`, 'https://route25.app');
      if (kind === 'collection') url.searchParams.set('token',token);
      url.searchParams.set('theme',document.querySelector('#embed-theme').value);
      if (kind === 'collection' && !document.querySelector('#show-value').checked) url.searchParams.set('value','0');
      const height = kind === 'trainer' ? 320 : 700;
      const title = kind === 'trainer' ? 'Route 25 trainer profile' : 'Route 25 card collection';
      const escape = value => value.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      code.value = `<iframe src="${escape(url.href)}" title="${title}" width="100%" height="${height}" style="border:0;border-radius:20px;max-width:760px" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
      // Keep preview on this deployment, while the copied code uses the public site.
      preview.src = url.pathname + url.search; preview.height = height; preview.title = title;
      result.hidden = false;
    } catch (e) { error.textContent = e.message; }
  }
  form.addEventListener('submit', update);
  document.querySelector('#copy-code').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code.value); status.textContent = 'Embed code copied.'; }
    catch { code.focus(); code.select(); status.textContent = 'Select and copy the code above.'; }
  });
})();
