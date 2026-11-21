function renderBrowseHeading(view = "cards", query = {}) {
  const params = new URLSearchParams();
  for (const key of ["q", "region", "page", "language", "filter"]) {
    if (typeof query[key] === "string" && query[key]) params.set(key, query[key]);
  }
  const cardsUrl = `/browse${params.size ? `?${params}` : ""}`.replaceAll("&", "&amp;");
  params.set("view", "sets");
  const setsUrl = `/browse?${params}`.replaceAll("&", "&amp;");
  return `<div class="browse-heading"><p class="badge">Pokémon TCG catalog</p><h1>Browse cards &amp; sets.</h1><p>Find your next chase, or explore a whole expansion.</p></div>
  <nav class="browse-views" aria-label="Browse catalog"><a href="${cardsUrl}"${view === "cards" ? ' aria-current="page"' : ""}>Cards</a><a href="${setsUrl}"${view === "sets" ? ' aria-current="page"' : ""}>Sets</a></nav>`;
}

module.exports = { renderBrowseHeading };
