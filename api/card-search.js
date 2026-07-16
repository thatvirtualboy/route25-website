const APP_STORE_URL = "https://apps.apple.com/us/app/route-25-tcg-social-network/id6755665546";
const X_URL = "https://x.com/route25app";
const INSTAGRAM_URL = "https://www.instagram.com/route25app/";
const DISCORD_URL = "https://discord.gg/WncmGEFuNw";
const APP_STORE_ID = "6755665546";

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, function(char) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
  });
}

function appDeepLink(path) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `route25://${cleanPath}`;
}

function featuredCardUrl(id, name, imageLarge) {
  const url = new URL(`/cards/${encodeURIComponent(id)}`, "https://route25.app");
  url.searchParams.set("name", name);
  url.searchParams.set("imageLarge", imageLarge);
  return url.pathname + url.search;
}

function socialToolbar() {
  return `<span class="social-toolbar" aria-label="Route 25 social links">
    <a href="${X_URL}" target="_blank" rel="noopener noreferrer" aria-label="Route 25 on X" class="social-link x-link">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.504 11.24h-6.66l-5.213-6.817-5.966 6.817H1.68l7.73-8.835L1.25 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    </a>
    <a href="${INSTAGRAM_URL}" target="_blank" rel="noopener noreferrer" aria-label="Route 25 on Instagram" class="social-link instagram-link">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.25-.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
    </a>
    <a href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer" aria-label="Route 25 on Discord" class="social-link discord-link">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 15.36 2.84a13.44 13.44 0 0 0-.635 1.313 18.34 18.34 0 0 0-5.45 0 12.53 12.53 0 0 0-.645-1.313 19.74 19.74 0 0 0-4.958 1.53C.535 9.045-.319 13.61.099 18.112a19.9 19.9 0 0 0 6.073 3.049 14.64 14.64 0 0 0 1.303-2.104 12.86 12.86 0 0 1-2.048-.975c.172-.126.34-.257.5-.391 3.948 1.82 8.23 1.82 12.13 0 .164.134.332.265.5.391-.65.385-1.337.712-2.054.978.373.735.81 1.438 1.304 2.101a19.86 19.86 0 0 0 6.077-3.05c.49-5.22-.839-9.742-3.567-13.742ZM8.02 15.332c-1.18 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.974 0c-1.18 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/></svg>
    </a>
    <a href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer" aria-label="Download Route 25 on the App Store" class="social-link app-store-link">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.365 1.43c0 1.14-.421 2.139-1.264 2.996-.882.892-1.913 1.405-3.016 1.322-.132-1.088.438-2.23 1.222-3.035C14.172 1.824 15.598 1.155 16.365 1.43ZM20.509 17.37c-.538 1.235-.797 1.785-1.489 2.876-.968 1.488-2.332 3.344-4.018 3.36-1.498.014-1.884-.986-3.918-.975-2.034.01-2.458.993-3.957.979-1.687-.016-2.974-1.69-3.943-3.178-2.706-4.15-2.99-9.02-1.319-11.61 1.188-1.838 3.064-2.914 4.829-2.914 1.797 0 2.927.986 4.415.986 1.443 0 2.322-.988 4.403-.988 1.574 0 3.24.858 4.424 2.34-3.886 2.13-3.254 7.677.573 9.124Z"/></svg>
    </a>
  </span>`;
}

function renderSearchPage() {
  const appArgument = appDeepLink("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Card Search | Route 25</title>
  <meta name="description" content="Search Pokemon TCG cards by card name on Route 25." />
  <meta name="theme-color" content="#05060a" />
  <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${escapeHtml(appArgument)}" />
  <link rel="canonical" href="https://route25.app/search" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/site.css" />
  <style>
    .search-shell {
      padding: clamp(128px, 10vw, 142px) 0 68px;
    }
    .search-head {
      display: grid;
      justify-items: center;
      gap: 14px;
      margin: 0 auto 28px;
      text-align: center;
    }
    .card-fan {
      position: relative;
      width: min(560px, 94vw);
      height: 190px;
      margin: 0 auto 8px;
    }
    .fan-card {
      --fan-x: 0px;
      --fan-y: 0px;
      --fan-rotation: 0deg;
      position: absolute;
      left: 50%;
      bottom: 0;
      width: 142px;
      aspect-ratio: 367 / 512;
      border-radius: 8px;
      transform: translateX(var(--fan-x)) translateY(var(--fan-y)) rotate(var(--fan-rotation));
      transform-origin: 50% 88%;
      transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .fan-card:hover,
    .fan-card:focus-visible {
      z-index: 20;
      outline: none;
      transform: translateX(var(--fan-x)) translateY(calc(var(--fan-y) - 18px)) rotate(var(--fan-rotation)) scale(1.07);
    }
    .fan-card img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 8px;
      backface-visibility: hidden;
      image-rendering: auto;
      box-shadow: 0 24px 28px rgba(0, 0, 0, 0.48);
      transition: box-shadow 220ms ease;
    }
    .fan-card:hover img,
    .fan-card:focus-visible img {
      box-shadow: 0 30px 34px rgba(0, 0, 0, 0.58);
    }
    .fan-card:nth-child(1) {
      --fan-x: -246px;
      --fan-rotation: -22deg;
      width: 136px;
    }
    .fan-card:nth-child(2) {
      --fan-x: -178px;
      --fan-y: -7px;
      --fan-rotation: -14deg;
      width: 148px;
      z-index: 1;
    }
    .fan-card:nth-child(3) {
      --fan-x: -108px;
      --fan-y: -18px;
      --fan-rotation: -6deg;
      width: 160px;
      z-index: 3;
    }
    .fan-card:nth-child(4) {
      --fan-x: -36px;
      --fan-y: -26px;
      --fan-rotation: 5deg;
      width: 174px;
      z-index: 5;
    }
    .fan-card:nth-child(5) {
      --fan-x: 67px;
      --fan-y: -12px;
      --fan-rotation: 13deg;
      width: 156px;
      z-index: 4;
    }
    .fan-card:nth-child(6) {
      --fan-x: 157px;
      --fan-rotation: 22deg;
      width: 138px;
      z-index: 2;
    }
    .search-head h1 {
      margin: 0;
      font-size: clamp(3.1rem, 10vw, 5.8rem);
      line-height: 0.92;
    }
    .search-copy {
      color: var(--muted);
      line-height: 1.5;
      margin: 0;
      max-width: 54ch;
    }
    .search-panel {
      width: min(820px, 100%);
    }
    .search-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 124px;
      gap: 10px;
      align-items: center;
    }
    .field {
      text-align: left;
    }
    .field label {
      display: block;
      color: rgba(255, 255, 255, 0.62);
      font-size: 11px;
      font-weight: 750;
      margin: 0 0 6px;
      text-transform: uppercase;
    }
    .input-wrap {
      position: relative;
    }
    .search-field {
      min-width: 0;
    }
    .search-icon {
      position: absolute;
      left: 18px;
      top: 50%;
      width: 22px;
      height: 22px;
      transform: translateY(-50%);
      color: rgba(255, 255, 255, 0.58);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: var(--ink);
      font: inherit;
      outline: none;
    }
    .search-input {
      height: clamp(62px, 8vw, 76px);
      border-radius: 999px;
      padding: 0 24px 0 54px;
      background: rgba(255, 255, 255, 0.095);
      font-size: clamp(1.08rem, 3vw, 1.34rem);
      box-shadow: 0 22px 70px rgba(0, 0, 0, 0.32);
    }
    .search-input:focus {
      border-color: rgba(88, 199, 255, 0.72);
      box-shadow: 0 0 0 3px rgba(88, 199, 255, 0.14);
    }
    .search-form .button {
      width: 100%;
      height: clamp(62px, 8vw, 76px);
      border-radius: 999px;
      cursor: pointer;
    }
    .search-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 22px 0 14px;
      color: var(--muted);
      font-size: 13px;
    }
    .search-meta-bottom {
      justify-content: flex-end;
      margin: 18px 0 0;
    }
    .pager {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }
    .pager .button {
      border-radius: 8px;
      min-width: 42px;
      padding: 8px 10px;
    }
    .pager .button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
    }
    .results-grid {
      display: grid;
      grid-template-columns: repeat(8, minmax(0, 1fr));
      gap: 18px;
    }
    .result-card {
      display: block;
      min-width: 0;
      padding: 5px;
      border-radius: 12px;
      transition: transform 180ms ease, background 180ms ease;
    }
    .result-card:hover {
      transform: translateY(-5px) scale(1.015);
      text-decoration: none;
      background: rgba(255, 255, 255, 0.055);
    }
    .result-card img {
      width: 100%;
      aspect-ratio: 367 / 512;
      object-fit: contain;
      border-radius: 8px;
      filter: drop-shadow(0 16px 18px rgba(0, 0, 0, 0.42));
    }
    .empty-state {
      display: none;
      padding: 38px 18px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: var(--muted);
      text-align: center;
      background: rgba(255, 255, 255, 0.04);
    }
    @media (max-width: 1040px) {
      .results-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
    }
    @media (max-width: 860px) {
      .results-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
    @media (max-width: 780px) {
      .search-shell {
        padding-top: 72px;
      }
      .card-fan {
        width: min(370px, 96vw);
        height: 158px;
      }
      .fan-card {
        width: 92px;
      }
      .fan-card:nth-child(1) {
        --fan-x: -165px;
        width: 82px;
      }
      .fan-card:nth-child(2) {
        --fan-x: -120px;
        --fan-y: -5px;
        width: 91px;
      }
      .fan-card:nth-child(3) {
        --fan-x: -75px;
        --fan-y: -12px;
        width: 101px;
      }
      .fan-card:nth-child(4) {
        --fan-x: -26px;
        --fan-y: -17px;
        width: 111px;
      }
      .fan-card:nth-child(5) {
        --fan-x: 38px;
        --fan-y: -8px;
        width: 98px;
      }
      .fan-card:nth-child(6) {
        --fan-x: 94px;
        width: 84px;
      }
      .search-form {
        grid-template-columns: minmax(0, 1fr) 108px;
      }
      .search-meta {
        align-items: flex-start;
        flex-direction: column;
      }
      .results-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .topbar .nav > a:not(.button),
      .topbar .social-toolbar {
        display: none;
      }
    }
    @media (max-width: 440px) {
      .search-form {
        grid-template-columns: 1fr;
      }
      .search-form .button {
        height: 54px;
      }
      .results-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 380px) {
      .fan-card:nth-child(1) {
        --fan-x: -145px;
        width: 74px;
      }
      .fan-card:nth-child(2) {
        --fan-x: -105px;
        width: 84px;
      }
      .fan-card:nth-child(3) {
        --fan-x: -67px;
        width: 94px;
      }
      .fan-card:nth-child(4) {
        --fan-x: -24px;
        width: 104px;
      }
      .fan-card:nth-child(5) {
        --fan-x: 32px;
        width: 91px;
      }
      .fan-card:nth-child(6) {
        --fan-x: 82px;
        width: 76px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .fan-card,
      .result-card {
        transition: none;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/" aria-label="Route 25 home">
        <img src="/assets/Icon.png" alt="" />
        <span>Route 25</span>
      </a>
      <nav class="nav" aria-label="Primary">
        <a href="/#features">Features</a>
        <a href="/search">Search cards</a>
        ${socialToolbar()}
      </nav>
    </div>
  </header>
  <main class="search-shell">
    <div class="container">
      <section class="search-head">
        <nav class="card-fan" aria-label="Featured cards">
          <a class="fan-card" href="${escapeHtml(featuredCardUrl("swsh8-271", "Gengar VMAX", "https://images.pokemontcg.io/swsh8/271_hires.png"))}" aria-label="View Gengar VMAX"><img src="https://images.pokemontcg.io/swsh8/271_hires.png" alt="Gengar VMAX" width="734" height="1024" loading="eager" fetchpriority="high" decoding="sync" /></a>
          <a class="fan-card" href="${escapeHtml(featuredCardUrl("swsh12pt5-160", "Pikachu", "https://images.pokemontcg.io/swsh12pt5/160_hires.png"))}" aria-label="View Pikachu"><img src="https://images.pokemontcg.io/swsh12pt5/160_hires.png" alt="Pikachu" width="734" height="1024" loading="eager" fetchpriority="high" decoding="sync" /></a>
          <a class="fan-card" href="${escapeHtml(featuredCardUrl("swsh11-186", "Giratina V", "https://images.pokemontcg.io/swsh11/186_hires.png"))}" aria-label="View Giratina V"><img src="https://images.pokemontcg.io/swsh11/186_hires.png" alt="Giratina V" width="734" height="1024" loading="eager" fetchpriority="high" decoding="sync" /></a>
          <a class="fan-card" href="${escapeHtml(featuredCardUrl("me2-125", "Mega Charizard X ex", "https://images.pokemontcg.io/me2/125_hires.png"))}" aria-label="View Mega Charizard X ex"><img src="https://images.pokemontcg.io/me2/125_hires.png" alt="Mega Charizard X ex" width="733" height="1024" loading="eager" fetchpriority="high" decoding="sync" /></a>
          <a class="fan-card" href="${escapeHtml(featuredCardUrl("swsh7-215", "Umbreon VMAX", "https://images.pokemontcg.io/swsh7/215_hires.png"))}" aria-label="View Umbreon VMAX"><img src="https://images.pokemontcg.io/swsh7/215_hires.png" alt="Umbreon VMAX" width="734" height="1024" loading="eager" fetchpriority="high" decoding="sync" /></a>
          <a class="fan-card" href="${escapeHtml(featuredCardUrl("sv3pt5-199", "Charizard ex", "https://images.pokemontcg.io/sv3pt5/199_hires.png"))}" aria-label="View Charizard ex"><img src="https://images.pokemontcg.io/sv3pt5/199_hires.png" alt="Charizard ex" width="733" height="1024" loading="eager" fetchpriority="high" decoding="sync" /></a>
        </nav>
        <div>
          <p class="badge"><span class="pulse"></span> Card search</p>
          <h1>Find a card.</h1>
          <p class="search-copy">Search by card name.</p>
        </div>
        <div class="search-panel">
          <form class="search-form" id="searchForm">
            <div class="field search-field">
              <div class="input-wrap">
                <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>
                <input class="search-input" id="cardQuery" name="q" type="search" placeholder="Search Pokemon cards" autocomplete="off" aria-label="Search Pokemon cards" />
              </div>
            </div>
            <button class="button primary" type="submit">Search</button>
          </form>
        </div>
      </section>
      <section aria-live="polite" aria-busy="false" id="resultsSection" hidden>
        <div class="search-meta">
          <span id="resultSummary">Loading cards...</span>
          <span class="pager">
            <button class="button" type="button" data-page-action="prev" aria-label="Previous page">Prev</button>
            <span data-page-label>Page 1</span>
            <button class="button" type="button" data-page-action="next" aria-label="Next page">Next</button>
          </span>
        </div>
        <div class="empty-state" id="emptyState">No cards found. Try a broader card name.</div>
        <div class="results-grid" id="resultsGrid"></div>
        <div class="search-meta search-meta-bottom">
          <span class="pager">
            <button class="button" type="button" data-page-action="prev" aria-label="Previous page">Prev</button>
            <span data-page-label>Page 1</span>
            <button class="button" type="button" data-page-action="next" aria-label="Next page">Next</button>
          </span>
        </div>
      </section>
    </div>
  </main>
  <script>
    const state = {
      q: new URLSearchParams(window.location.search).get("q") || "",
      page: Math.max(1, Number.parseInt(new URLSearchParams(window.location.search).get("page") || "1", 10) || 1),
      pageSize: 32,
      totalCount: 0,
      loading: false
    };
    const form = document.getElementById("searchForm");
    const queryInput = document.getElementById("cardQuery");
    const resultsSection = document.getElementById("resultsSection");
    const resultsGrid = document.getElementById("resultsGrid");
    const resultSummary = document.getElementById("resultSummary");
    const emptyState = document.getElementById("emptyState");
    const pageLabels = Array.from(document.querySelectorAll("[data-page-label]"));
    const prevPageButtons = Array.from(document.querySelectorAll("[data-page-action='prev']"));
    const nextPageButtons = Array.from(document.querySelectorAll("[data-page-action='next']"));
    let activeController = null;
    let activeRequestKey = "";
    const resultCache = new Map();
    const inFlightResults = new Map();
    const prefetchedCardPages = new Set();

    window.route25CardImageFallback = function(img) {
      const fallbacks = String(img.dataset.fallbacks || "").split("|").filter(Boolean);
      const next = fallbacks.shift();
      if (!next) {
        img.removeAttribute("onerror");
        return;
      }
      img.dataset.fallbacks = fallbacks.join("|");
      img.src = next;
    };

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, function(char) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
      });
    }

    function updateUrl() {
      const params = new URLSearchParams();
      if (state.q) params.set("q", state.q);
      if (state.page > 1) params.set("page", String(state.page));
      const query = params.toString();
      history.replaceState(null, "", query ? "/search?" + query : "/search");
    }

    function cardUrl(card) {
      const id = card.id || "";
      const url = new URL("/cards/" + encodeURIComponent(id), window.location.origin);
      const smallImages = cardImageCandidates(card, false);
      const largeImages = cardImageCandidates(card, true);
      const imageFallbacks = largeImages.concat(smallImages).filter(function(candidate, index, all) {
        return candidate && all.indexOf(candidate) === index;
      });
      const setName = card.set && card.set.name ? card.set.name : "";
      const hints = {
        name: card.name,
        number: card.number,
        setName: setName,
        rarity: card.rarity,
        types: Array.isArray(card.types) ? card.types.join("|") : "",
        artist: card.artist,
        regulationMark: card.regulationMark,
        imageSmall: smallImages[0],
        imageLarge: largeImages[0],
        imageFallbacks: imageFallbacks.slice(1, 10).join("|")
      };
      Object.keys(hints).forEach(function(key) {
        if (hints[key]) url.searchParams.set(key, hints[key]);
      });
      return url.pathname + url.search;
    }

    function prefetchCardPage(url) {
      if (!url || prefetchedCardPages.has(url)) return;
      prefetchedCardPages.add(url);
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = url;
      document.head.appendChild(link);
    }

    function searchParamsFor(nextState) {
      return new URLSearchParams({
        q: nextState.q,
        page: String(nextState.page),
        pageSize: String(nextState.pageSize)
      });
    }

    function cacheKey(nextState) {
      return searchParamsFor(nextState).toString();
    }

    function tcgplayerImages(card, large) {
      const variants = Array.isArray(card.cardVariants) ? card.cardVariants : [];
      const urls = [];
      for (let i = 0; i < variants.length; i += 1) {
        const productId = variants[i] && variants[i].sourceRefs && variants[i].sourceRefs.tcgplayerProductId;
        if (productId) {
          urls.push("https://tcgplayer-cdn.tcgplayer.com/product/" + productId + (large ? "_in_1000x1000" : "_200w") + ".jpg");
        }
      }
      return urls;
    }

    function mepExtensionFallbacks(url) {
      const raw = String(url || "");
      if (raw.indexOf("/card-images/mep/") === -1 || !/mep-[^/]+\.[a-z0-9]+$/i.test(raw)) return [];
      const base = raw.replace(/\.[a-z0-9]+$/i, "");
      return ["webp", "png", "jpg"].map(function(ext) {
        return base + "." + ext;
      }).filter(function(nextUrl) {
        return nextUrl !== raw;
      });
    }

    function cardImageCandidates(card, large) {
      const images = card.images || {};
      const candidates = [
        large ? images.large : images.small,
        large ? images.small : images.large,
      ].concat(tcgplayerImages(card, Boolean(large)), tcgplayerImages(card, !large));
      const expanded = [];
      candidates.forEach(function(candidate) {
        if (!candidate) return;
        expanded.push(candidate);
        mepExtensionFallbacks(candidate).forEach(function(fallback) {
          expanded.push(fallback);
        });
      });
      return expanded.filter(function(candidate, index) {
        return candidate && expanded.indexOf(candidate) === index;
      });
    }

    function imageFallbackAttribute(candidates) {
      return candidates.length > 1
        ? ' data-fallbacks="' + escapeHtml(candidates.slice(1).join("|")) + '" onerror="route25CardImageFallback(this)"'
        : "";
    }

    function renderCard(card, index) {
      const imageCandidates = cardImageCandidates(card, false);
      const img = imageCandidates[0];
      const url = cardUrl(card);
      if (!img) return "";
      const loading = index < 6 ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"';
      return '<a class="result-card" href="' + url + '" aria-label="View ' + escapeHtml(card.name) + '">' +
        '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(card.name) + ' card"' + loading + ' decoding="async"' + imageFallbackAttribute(imageCandidates) + ' /></a>';
    }

    function renderPayload(payload) {
      const cards = payload.ok && Array.isArray(payload.data) ? payload.data : [];
      state.totalCount = Number(payload.totalCount || cards.length);
      resultsGrid.innerHTML = cards.map(renderCard).join("");
      emptyState.textContent = "No cards found. Try a broader card name.";
      emptyState.style.display = cards.length ? "none" : "block";
      const start = cards.length ? ((state.page - 1) * state.pageSize) + 1 : 0;
      const end = cards.length ? start + cards.length - 1 : 0;
      resultSummary.textContent = cards.length
        ? "Showing " + start + "-" + end + " of " + state.totalCount.toLocaleString() + " cards"
        : "No cards found";
    }

    function setLoading(isLoading) {
      state.loading = isLoading;
      resultsSection.classList.toggle("loading", isLoading);
      resultsSection.setAttribute("aria-busy", isLoading ? "true" : "false");
      const maxPage = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
      pageLabels.forEach(function(label) {
        label.textContent = "Page " + state.page;
      });
      prevPageButtons.forEach(function(button) {
        button.disabled = isLoading || state.page <= 1;
      });
      nextPageButtons.forEach(function(button) {
        button.disabled = isLoading || state.page >= maxPage;
      });
    }

    async function fetchCardsFor(nextState, options) {
      const key = cacheKey(nextState);
      if (resultCache.has(key)) return resultCache.get(key);
      if (inFlightResults.has(key)) return inFlightResults.get(key);
      const url = "/api/card-search?" + searchParamsFor(nextState).toString();
      const request = (async function() {
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error("Card search failed with status " + response.status);
            return await response.json();
          } catch (error) {
            if (error && error.name === "AbortError") throw error;
            lastError = error;
            if (attempt === 0) await new Promise(function(resolve) { setTimeout(resolve, 160); });
          }
        }
        throw lastError || new Error("Card search failed");
      })()
        .then(function(payload) {
          if (resultCache.size > 40) resultCache.delete(resultCache.keys().next().value);
          resultCache.set(key, payload);
          return payload;
        })
        .finally(function() {
          inFlightResults.delete(key);
        });
      inFlightResults.set(key, request);
      return request;
    }

    async function loadCards() {
      if (!state.q) {
        if (activeController) activeController.abort();
        activeRequestKey = "";
        state.page = 1;
        state.totalCount = 0;
        resultsGrid.innerHTML = "";
        emptyState.style.display = "none";
        resultsSection.hidden = true;
        setLoading(false);
        updateUrl();
        return;
      }

      updateUrl();
      const key = cacheKey(state);
      if (activeController && activeRequestKey && activeRequestKey !== key) activeController.abort();
      activeRequestKey = key;

      if (resultCache.has(key)) {
        resultsSection.hidden = false;
        renderPayload(resultCache.get(key));
        setLoading(false);
        return;
      }

      resultsGrid.innerHTML = "";
      emptyState.style.display = "none";
      resultSummary.textContent = "Searching cards...";
      state.totalCount = 0;
      resultsSection.hidden = false;
      const shouldStartRequest = !inFlightResults.has(key);
      const requestController = shouldStartRequest ? new AbortController() : null;
      if (requestController) activeController = requestController;
      setLoading(true);

      try {
        const payload = await fetchCardsFor(state, requestController ? { signal: requestController.signal } : undefined);
        if (activeRequestKey !== key) return;
        renderPayload(payload);
      } catch (error) {
        if (error.name === "AbortError") return;
        resultsGrid.innerHTML = "";
        emptyState.textContent = "Search is temporarily unavailable. Please try again.";
        emptyState.style.display = "block";
        resultSummary.textContent = "Search is unavailable";
      } finally {
        if (requestController && activeController === requestController) activeController = null;
        if (activeRequestKey === key) setLoading(false);
      }
    }

    queryInput.value = state.q;
    loadCards();
    if (!state.q) {
      fetch("/api/card-search?q=base1-1&pageSize=1", { headers: { accept: "application/json" } }).catch(function() {});
    }

    form.addEventListener("submit", async function(event) {
      event.preventDefault();
      state.q = queryInput.value.trim();
      state.page = 1;
      await loadCards();
      if (state.q && !resultsSection.hidden) {
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    queryInput.addEventListener("input", function() {
      if (queryInput.value.trim() === state.q) return;
      if (activeController) activeController.abort();
      activeRequestKey = "";
      state.totalCount = 0;
      resultsGrid.innerHTML = "";
      emptyState.style.display = "none";
      setLoading(false);
      resultsSection.hidden = true;
    });
    document.querySelectorAll("[data-page-action]").forEach(function(button) {
      button.addEventListener("click", function() {
        if (button.dataset.pageAction === "prev") {
          if (state.page > 1) {
            state.page -= 1;
            loadCards();
          }
          return;
        }
        state.page += 1;
        loadCards();
      });
    });
    resultsGrid.addEventListener("mouseover", function(event) {
      const link = event.target.closest && event.target.closest(".result-card");
      if (link) prefetchCardPage(link.getAttribute("href"));
    });
    resultsGrid.addEventListener("focusin", function(event) {
      const link = event.target.closest && event.target.closest(".result-card");
      if (link) prefetchCardPage(link.getAttribute("href"));
    });
  </script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "s-maxage=3600, stale-while-revalidate=86400");
  res.end(renderSearchPage());
};
