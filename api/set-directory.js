const { renderBrowseHeading } = require("../lib/browse-layout");
const { renderSiteHeader } = require("../lib/site-header");
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
        "@id": `${SITE_ORIGIN}/browse?view=sets#webpage`,
        url: `${SITE_ORIGIN}/browse?view=sets`,
        name: "Pokemon TCG Set Lists and Card Database | Route 25",
        description: "Browse English, Japanese, and Simplified Chinese Pokemon TCG expansions, complete set lists, individual card pages, artwork, rarity, and collector details."
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_ORIGIN}/browse?view=sets#sets`,
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
        "@id": `${SITE_ORIGIN}/browse?view=sets#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Route 25", item: `${SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Pokemon TCG sets", item: `${SITE_ORIGIN}/browse?view=sets` }
        ]
      }
    ]
  };
}

function renderDirectory(groups, query = {}, unavailable = false) {
  const sets = groups.flatMap(group => group.sets);
  const total = sets.length;
  const language = [...regions, "all"].includes(query.language) ? query.language : regions.includes(query.region) ? query.region : "all";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Browse Pokémon TCG Sets | Route 25</title>
  <meta name="description" content="Browse English, Japanese, and Simplified Chinese Pokemon TCG expansions, complete set lists, individual card pages, artwork, rarity, and collector details." />
  <meta name="robots" content="${unavailable ? "noindex,nofollow" : "index, follow, max-image-preview:large"}" />
  <link rel="canonical" href="${SITE_ORIGIN}/browse?view=sets" />
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
<link rel="stylesheet" href="/assets/public.css?v=20261121a" />
<script defer src="/assets/public.js?v=20261121a"></script>
<link rel="stylesheet" href="/assets/navigation.css?v=20261121a" />
<link rel="stylesheet" href="/assets/browse.css?v=20261121a" />
</head>
<body class="public-page directory-page browse-page">
  <a class="skip-link" href="#main">Skip to content</a>
  ${renderSiteHeader("browse")}
  <main id="main" class="directory-main">
    <div class="container">
      ${renderBrowseHeading("sets", query)}
      ${unavailable ? '<div class="directory-unavailable" role="status"><h2>Sets are temporarily unavailable.</h2><p>Please try again in a moment. You can still search for individual cards.</p><a class="button" href="/browse">Search cards</a></div>' : ""}
      <div class="directory-head"${unavailable ? " hidden" : ""}>
        <p>Explore ${escapeHtml(String(total))} English, Japanese, and Simplified Chinese Pokémon TCG expansions. Open a set to see its cards, artwork, and values.</p>
        <div class="directory-search">
          <label for="set-filter">Find a set</label>
          <input id="set-filter" type="search" placeholder="Try Surging Sparks, SV8, or Battle Partners" autocomplete="off" />
        </div>
        <div class="set-filter-controls">
          ${languagePicker(language, { sets: true })}
          <button class="set-filter-reset" type="button" id="reset-set-filters" hidden>Clear filters</button>
        </div>
        <p class="set-filter-status" id="set-filter-status" role="status" aria-live="polite"></p>
      </div>
      ${groups.map(({ region, name, sets, unavailable: catalogUnavailable }) => `<section class="directory-section" data-set-region="${region}" data-catalog="${region}"${unavailable || (language !== "all" && language !== region) ? " hidden" : ""} aria-labelledby="${region}-sets" data-unavailable="${catalogUnavailable}">
        <div class="directory-section-head"><h2 id="${region}-sets">${name} sets</h2><span>${sets.length} sets</span></div>
        ${catalogUnavailable ? '<p role="status">This catalog is temporarily unavailable. Please try again shortly.</p>' : ""}
        <div class="directory-grid">${renderSetCards(sets, name)}</div>
        ${region === "cn" ? SOURCE : ""}
      </section>`).join("")}
      <p class="directory-empty" id="directory-empty" hidden>No sets match these filters. Try another name or language, or clear your filters.</p>
    </div>
  </main>
  <footer><div class="container footer-inner"><span>Route 25 Pokemon TCG card database</span><div class="footer-links"><a href="/browse?view=sets">Browse sets</a><a href="/browse">Search cards</a><a href="/">Get the app</a></div></div></footer>
  <script>
    (() => {
      const input = document.getElementById("set-filter");
      const cards = [...document.querySelectorAll("[data-set-search]")];
      const empty = document.getElementById("directory-empty");
      const languageButtons = [...document.querySelectorAll("[data-set-language]")];
      const reset = document.getElementById("reset-set-filters");
      const status = document.getElementById("set-filter-status");
      let language = ${jsonScript(language)};
      function filterSets() {
        const query = input.value.trim().toLowerCase();
        let visible = 0;
        for (const card of cards) {
          const regionMatches = language === "all" || card.closest("[data-set-region]").dataset.setRegion === language;
          const match = regionMatches && (!query || card.dataset.setSearch.includes(query));
          card.hidden = !match;
          if (match) visible += 1;
        }
        const unavailableSelection = [...document.querySelectorAll('[data-unavailable="true"]')].some(section => language === "all" || section.dataset.setRegion === language);
        empty.hidden = visible !== 0 || !cards.length || unavailableSelection;
        status.textContent = cards.length ? visible + (visible === 1 ? " set" : " sets") + " found" : "";
        reset.hidden = !query && language === "all";
        languageButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.setLanguage === language)));
        for (const section of document.querySelectorAll(".directory-section")) {
          const count = [...section.querySelectorAll("[data-set-search]")].filter(card => !card.hidden).length;
          const selected = language === "all" || section.dataset.setRegion === language;
          section.hidden = !selected || (count === 0 && section.dataset.unavailable !== "true");
          section.querySelector(".directory-section-head span").textContent = count + (count === 1 ? " set" : " sets");
        }
      }
      input.value = new URLSearchParams(location.search).get("filter") || "";
      filterSets();
      function updateFilters() {
        filterSets();
        const params = new URLSearchParams(location.search);
        params.set("view", "sets");
        params.set("language", language);
        if (input.value.trim()) params.set("filter", input.value.trim());
        else params.delete("filter");
        history.replaceState(null, "", "/browse?" + params.toString());
        params.delete("view");
        document.querySelector(".browse-views a:first-child").href = "/browse?" + params.toString();
      }
      input.addEventListener("input", updateFilters);
      languageButtons.forEach(button => button.addEventListener("click", () => {
        language = button.dataset.setLanguage;
        updateFilters();
      }));
      reset.addEventListener("click", () => {
        input.value = "";
        language = "all";
        updateFilters();
        input.focus();
      });
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
    return res.end(renderDirectory(groups, req.query, true));
  }
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", groups.some(group => group.unavailable) ? "s-maxage=30" : "s-maxage=21600, stale-while-revalidate=86400");
  res.end(renderDirectory(groups, req.query));
};

module.exports.normalizeSets = normalizeSets;
module.exports.renderDirectory = renderDirectory;
