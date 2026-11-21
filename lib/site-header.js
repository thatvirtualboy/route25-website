// Shared by server-rendered pages and scripts/sync-site-header.js for static pages.
function renderSiteHeader(active = "") {
  const current = name => active === name ? ' aria-current="page"' : "";
  return `<header class="site-header"><div class="site-header-inner">
  <a class="site-brand" href="/" aria-label="Route 25 home"><img src="/apple-touch-icon.png" alt="" width="30" height="30" /><span>Route 25</span></a>
  <nav class="site-nav" id="site-navigation" aria-label="Primary"><a href="/#features">Features</a><a href="/browse"${current("browse")}>Browse</a><a href="/giveaways"${current("giveaways")}>Giveaways</a><a href="/newsletter"${current("spotlights")}>Collector Spotlights</a><a class="site-download" href="/#download">Get the app</a></nav>
  <button class="site-menu-toggle" type="button" aria-expanded="false" aria-controls="site-navigation" hidden>Menu</button>
</div></header>`;
}

module.exports = { renderSiteHeader };
