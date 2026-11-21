const { languagePicker } = require("../lib/catalog-picker");
const { SOURCE } = require("../lib/chinese-catalog");
const { loadSetCatalogs, normalizeSets, regions } = require("../lib/set-catalogs");
const { BACKEND_ORIGIN, catalogRegion } = require("../lib/route25-backend");
const { route25ImageUrl } = require("../lib/route25-image-url");

const SITE_ORIGIN = "https://route25.app";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function absoluteUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, BACKEND_ORIGIN).href;
  } catch {
    return "";
  }
}

function setCount(set) {
  if (catalogRegion(set.id) === "cn" && set.total != null) return set.total;
  return set?.printedTotal || set?.cardCount?.official || set?.total || set?.cardCount?.total || "";
}

function releaseYear(set) {
  const year = new Date(String(set?.releaseDate || "")).getFullYear();
  return Number.isFinite(year) ? String(year) : "";
}

function setLogo(set) {
  return route25ImageUrl(absoluteUrl(set?.images?.localLogo || set?.images?.logo || set?.images?.symbol));
}

function renderSetCards(sets, language) {
  return sets.map((set) => {
    const logo = setLogo(set);
    const year = releaseYear(set);
    const count = setCount(set);
    const searchText = [set.name, set.localized?.name, set.id, year, language].filter(Boolean).join(" ").toLowerCase();
    return `<a class="directory-set" href="/sets/${encodeURIComponent(set.id)}" data-set-search="${escapeHtml(searchText)}">
      <span class="directory-set-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />` : ""}</span>
      <span class="directory-set-copy">
        <strong>${escapeHtml(set.name)}</strong>
        <small>${escapeHtml([set.id.toUpperCase(), year, count ? `${count} cards` : ""].filter(Boolean).join(" · "))}</small>
      </span>
    </a>`;
  }).join("");
}

function structuredData(sets) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_ORIGIN}/sets#webpage`,
        url: `${SITE_ORIGIN}/sets`,
        name: "Pokemon TCG Set Lists and Card Database | Route 25",
        description: "Browse English, Japanese, and Simplified Chinese Pokemon TCG expansions, complete set lists, individual card pages, artwork, rarity, and collector details."
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_ORIGIN}/sets#sets`,
        name: "Pokemon TCG sets",
        numberOfItems: sets.length,
        itemListElement: sets.slice(0, 200).map((set, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: set.name,
          url: `${SITE_ORIGIN}/sets/${encodeURIComponent(set.id)}`
        }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_ORIGIN}/sets#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Route 25", item: `${SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Pokemon TCG sets", item: `${SITE_ORIGIN}/sets` }
        ]
      }
    ]
  };
}

function renderDirectory(groups, selected) {
  const sets = groups.flatMap(group => group.sets);
  const total = sets.length;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pokemon TCG Set Lists and Card Database | Route 25</title>
  <meta name="description" content="Browse English, Japanese, and Simplified Chinese Pokemon TCG expansions, complete set lists, individual card pages, artwork, rarity, and collector details." />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${SITE_ORIGIN}/sets" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/site.css" />
  <script type="application/ld+json">${jsonScript(structuredData(sets))}</script>
  <style>
    .directory-main { padding: clamp(42px, 7vw, 86px) 0 80px; }
    .directory-breadcrumb { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
    .directory-breadcrumb a { color: var(--ink); }
    .directory-head { max-width: 820px; }
    .directory-head h1 { font-size: clamp(46px, 8vw, 92px); line-height: .94; margin: 14px 0 20px; }
    .directory-head p { color: var(--muted); font-size: clamp(17px, 2vw, 21px); line-height: 1.6; }
    .directory-search { margin-top: 30px; max-width: 620px; }
    .directory-search .region-toggle { margin-bottom: 16px; }
    .directory-search label { display: block; font-weight: 700; margin-bottom: 9px; }
    .directory-search input { width: 100%; border: 1px solid var(--faint); border-radius: 14px; background: rgba(255,255,255,.07); color: var(--ink); font: inherit; padding: 15px 17px; }
    .directory-search input:focus { outline: 2px solid var(--accentC); outline-offset: 2px; }
    .directory-section { margin-top: clamp(48px, 8vw, 82px); }
    .directory-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .directory-section h2 { font-size: clamp(28px, 4vw, 44px); margin: 0; }
    .directory-section-head span { color: var(--muted); }
    .directory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .directory-set { display: flex; align-items: center; min-height: 88px; gap: 14px; padding: 14px; border: 1px solid var(--faint); border-radius: 16px; background: var(--card); }
    .directory-set:hover { background: rgba(255,255,255,.09); text-decoration: none; }
    .directory-set[hidden] { display: none; }
    .directory-set-logo { display: grid; place-items: center; width: 62px; height: 54px; flex: 0 0 62px; }
    .directory-set-logo img { max-width: 62px; max-height: 48px; object-fit: contain; }
    .directory-set-copy { min-width: 0; }
    .directory-set-copy strong, .directory-set-copy small { display: block; }
    .directory-set-copy strong { line-height: 1.25; }
    .directory-set-copy small { color: var(--muted); margin-top: 5px; line-height: 1.35; }
    .directory-empty { color: var(--muted); margin-top: 18px; }
  </style>
  <noscript><style>.directory-section[hidden] { display: block; } .directory-search { display: none; }</style></noscript>
<link rel="stylesheet" href="/assets/public.css?v=20261120" />
<script defer src="/assets/public.js?v=20261105a"></script>
</head>
<body class="public-page directory-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/" aria-label="Route 25 home"><img src="/apple-touch-icon.png" alt="" width="34" height="34" /><span>Route 25</span></a>
      <nav class="nav" aria-label="Primary"><a href="/sets" aria-current="page">Browse sets</a><a href="/search">Search cards</a><a href="/newsletter">Collector Spotlights</a></nav>
    </div>
  </header>
  <main id="main" class="directory-main">
    <div class="container">
      <nav class="directory-breadcrumb" aria-label="Breadcrumb"><a href="/">Route 25</a> / <span>Pokemon TCG sets</span></nav>
      <header class="directory-head">
        <p class="badge">Card database</p>
        <h1>Browse every set.</h1>
        <p>Explore ${escapeHtml(String(total))} English, Japanese, and Simplified Chinese Pokemon TCG expansions. Open a set for its complete card list, then view individual cards, artwork, rarity, values, and collector details.</p>
        <div class="directory-search">
          ${languagePicker(selected)}
          <label for="set-filter">Find a set</label>
          <input id="set-filter" type="search" placeholder="Try Surging Sparks, SV8, or Battle Partners" autocomplete="off" />
        </div>
      </header>
      ${groups.map(({region, name, sets, unavailable}) => `<section class="directory-section" data-catalog="${region}" ${region === selected ? "" : "hidden"}>
        <div class="directory-section-head"><h2>${name} sets</h2><span>${sets.length} sets</span></div>
        ${unavailable ? "<p>This catalog is temporarily unavailable. Please try again shortly.</p>" : ""}
        <div class="directory-grid">${renderSetCards(sets, name)}</div>
        ${region === "cn" ? SOURCE : ""}
      </section>`).join("")}
      <p class="directory-empty" id="directory-empty" hidden>No matching set found. Try a set name or code.</p>
    </div>
  </main>
  <footer><div class="container footer-inner"><span>Route 25 Pokemon TCG card database</span><div class="footer-links"><a href="/sets">Browse sets</a><a href="/search">Search cards</a><a href="/">Get the app</a></div></div></footer>
  <script>
    (() => {
      const input = document.getElementById("set-filter");
      const cards = [...document.querySelectorAll("[data-set-search]")];
      const empty = document.getElementById("directory-empty");
      const sections = [...document.querySelectorAll("[data-catalog]")];
      const buttons = [...document.querySelectorAll("[data-region]")];
      let region = ${jsonScript(selected)};
      function update() {
        sections.forEach(section => { section.hidden = section.dataset.catalog !== region; });
        buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.region === region)));
        const query = input.value.trim().toLowerCase();
        let visible = 0;
        for (const card of cards) {
          const match = !query || card.dataset.setSearch.includes(query);
          card.hidden = !match;
          if (match && !card.closest("[data-catalog]").hidden) visible += 1;
        }
        empty.hidden = !query || visible !== 0;
      }
      buttons.forEach(button => button.addEventListener("click", () => {
        region = button.dataset.region;
        const url = new URL(location.href);
        if (region === "international") url.searchParams.delete("region");
        else url.searchParams.set("region", region);
        history.replaceState(null, "", url);
        update();
      }));
      input.addEventListener("input", update);
      update();
    })();
  </script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const groups = await loadSetCatalogs();
  if (groups.every(group => !group.sets.length)) {
    res.statusCode = 503;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("retry-after", "60");
    return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Set directory unavailable | Route 25</title><link rel="stylesheet" href="/assets/public.css?v=20261120" />
<script defer src="/assets/public.js?v=20261105a"></script>
</head><body class="public-page directory-page utility-page"><h1>Set directory temporarily unavailable</h1></body></html>`);
  }
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", groups.some(group => group.unavailable) ? "s-maxage=30" : "s-maxage=21600, stale-while-revalidate=86400");
  res.end(renderDirectory(groups, regions.includes(req.query?.region) ? req.query.region : "international"));
};

module.exports.normalizeSets = normalizeSets;
module.exports.renderDirectory = renderDirectory;
