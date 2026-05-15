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

function renderSearchPage(req) {
  const initialSet = String(req?.query?.set || "").trim();
  const appArgument = initialSet ? appDeepLink(`sets/${initialSet}`) : appDeepLink("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Card Search | Route 25</title>
  <meta name="description" content="Search Pokemon TCG cards by name, card id, and set on Route 25." />
  <meta name="theme-color" content="#05060a" />
  <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${escapeHtml(appArgument)}" />
  <link rel="canonical" href="https://route25.app/search" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/site.css" />
  <style>
    .search-shell {
      padding: clamp(28px, 5vw, 56px) 0 64px;
    }
    .search-head {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(300px, 1.1fr);
      gap: clamp(18px, 4vw, 40px);
      align-items: end;
      margin-bottom: 24px;
    }
    .search-head h1 {
      max-width: 9ch;
      margin-bottom: 10px;
    }
    .search-copy {
      color: var(--muted);
      line-height: 1.55;
      margin: 0;
      max-width: 54ch;
    }
    .search-panel {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      box-shadow: var(--shadow-card);
      padding: 14px;
    }
    .search-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 144px;
      gap: 12px;
      align-items: end;
    }
    .set-app-link {
      display: none;
      margin-top: 12px;
      width: 100%;
      border-radius: 8px;
    }
    .set-app-link.is-visible {
      display: inline-flex;
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
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      width: 18px;
      height: 18px;
      transform: translateY(-50%);
      color: rgba(255, 255, 255, 0.58);
      pointer-events: none;
    }
    .search-input,
    .set-select {
      width: 100%;
      height: 48px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      background: rgba(5, 6, 10, 0.78);
      color: var(--ink);
      font: inherit;
      outline: none;
    }
    .search-input {
      padding: 0 12px 0 40px;
    }
    .set-select {
      padding: 0 10px;
    }
    .search-input:focus,
    .set-select:focus {
      border-color: rgba(88, 199, 255, 0.72);
      box-shadow: 0 0 0 3px rgba(88, 199, 255, 0.14);
    }
    .search-form .button {
      width: 100%;
      height: 48px;
      border-radius: 8px;
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
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 14px;
    }
    .result-card {
      display: grid;
      gap: 10px;
      align-content: start;
      min-height: 100%;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.055);
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
      transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
    }
    .result-card:hover {
      transform: translateY(-2px);
      text-decoration: none;
      border-color: rgba(88, 199, 255, 0.44);
      background: rgba(255, 255, 255, 0.078);
    }
    .result-card img {
      width: 100%;
      aspect-ratio: 367 / 512;
      object-fit: contain;
      border-radius: 8px;
      filter: drop-shadow(0 16px 18px rgba(0, 0, 0, 0.42));
    }
    .result-name {
      display: block;
      font-weight: 780;
      line-height: 1.25;
    }
    .result-sub {
      display: block;
      margin-top: 5px;
      color: rgba(255, 255, 255, 0.64);
      font-size: 12px;
      line-height: 1.35;
    }
    .result-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .result-tag {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      padding: 4px 7px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 11px;
      background: rgba(255, 255, 255, 0.055);
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
    .loading .results-grid {
      opacity: 0.44;
    }
    @media (max-width: 780px) {
      .search-head,
      .search-form {
        grid-template-columns: 1fr;
      }
      .search-meta {
        align-items: flex-start;
        flex-direction: column;
      }
      .results-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .topbar .nav > a:not(.button),
      .topbar .social-toolbar {
        display: none;
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
        ${socialToolbar()}
      </nav>
    </div>
  </header>
  <main class="search-shell">
    <div class="container">
      <section class="search-head">
        <div>
          <p class="badge"><span class="pulse"></span> Card search</p>
          <h1>Keep browsing.</h1>
          <p class="search-copy">Find cards by name, card id, or set, then keep browsing the cards you care about.</p>
        </div>
        <div class="search-panel">
          <form class="search-form" id="searchForm">
            <div class="field">
              <label for="cardQuery">Card</label>
              <div class="input-wrap">
                <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>
                <input class="search-input" id="cardQuery" name="q" type="search" placeholder="Charizard, Pikachu, sv3pt5-199" autocomplete="off" />
              </div>
            </div>
            <div class="field">
              <label for="setSelect">Set</label>
              <select class="set-select" id="setSelect" name="set">
                <option value="">All sets</option>
              </select>
            </div>
            <button class="button primary" type="submit">Search</button>
          </form>
          <a class="button set-app-link" id="openSetInApp" href="${escapeHtml(appArgument)}">Open this set in Route 25</a>
        </div>
      </section>
      <section aria-live="polite" aria-busy="false" id="resultsSection">
        <div class="search-meta">
          <span id="resultSummary">Loading cards...</span>
          <span class="pager">
            <button class="button" type="button" id="prevPage" aria-label="Previous page">Prev</button>
            <span id="pageLabel">Page 1</span>
            <button class="button" type="button" id="nextPage" aria-label="Next page">Next</button>
          </span>
        </div>
        <div class="empty-state" id="emptyState">No cards found. Try a broader name or remove the set filter.</div>
        <div class="results-grid" id="resultsGrid"></div>
      </section>
    </div>
  </main>
  <script>
    const state = {
      q: new URLSearchParams(window.location.search).get("q") || "",
      set: new URLSearchParams(window.location.search).get("set") || "",
      page: Math.max(1, Number.parseInt(new URLSearchParams(window.location.search).get("page") || "1", 10) || 1),
      pageSize: 24,
      totalCount: 0,
      loading: false
    };
    const form = document.getElementById("searchForm");
    const queryInput = document.getElementById("cardQuery");
    const setSelect = document.getElementById("setSelect");
    const resultsSection = document.getElementById("resultsSection");
    const resultsGrid = document.getElementById("resultsGrid");
    const resultSummary = document.getElementById("resultSummary");
    const emptyState = document.getElementById("emptyState");
    const pageLabel = document.getElementById("pageLabel");
    const prevPage = document.getElementById("prevPage");
    const nextPage = document.getElementById("nextPage");
    const openSetInApp = document.getElementById("openSetInApp");
    let debounceTimer = null;
    let activeController = null;
    let activeRequestKey = "";
    const resultCache = new Map();
    const prefetchedCardPages = new Set();

    function formatCurrency(value) {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) return "";
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, function(char) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
      });
    }

    function updateUrl() {
      const params = new URLSearchParams();
      if (state.q) params.set("q", state.q);
      if (state.set) params.set("set", state.set);
      if (state.page > 1) params.set("page", String(state.page));
      const query = params.toString();
      history.replaceState(null, "", query ? "/search?" + query : "/search");
    }

    function cardUrl(card) {
      const url = new URL("/cards/" + encodeURIComponent(card.id || ""), window.location.origin);
      if (card.name) url.searchParams.set("name", card.name);
      if (card.number) url.searchParams.set("number", card.number);
      if (card.set && card.set.name) url.searchParams.set("setName", card.set.name);
      if (card.rarity) url.searchParams.set("rarity", card.rarity);
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

    function prefetchVisibleCardPages(cards) {
      window.setTimeout(function() {
        cards.slice(0, 12).forEach(function(card) {
          prefetchCardPage(cardUrl(card));
        });
      }, 250);
    }

    function setDeepLink(setId) {
      return "route25://sets/" + encodeURIComponent(setId || "");
    }

    function updateSetDeepLink() {
      if (!state.set) {
        openSetInApp.classList.remove("is-visible");
        openSetInApp.removeAttribute("href");
        return;
      }
      openSetInApp.href = setDeepLink(state.set);
      openSetInApp.classList.add("is-visible");
    }

    function searchParamsFor(nextState) {
      return new URLSearchParams({
        q: nextState.q,
        set: nextState.set,
        page: String(nextState.page),
        pageSize: String(nextState.pageSize)
      });
    }

    function cacheKey(nextState) {
      return searchParamsFor(nextState).toString();
    }

    function renderCard(card) {
      const img = card.images && (card.images.small || card.images.large);
      const setName = card.set && card.set.name ? card.set.name : "";
      const market = formatCurrency(card.market);
      const tags = [card.rarity, market].filter(Boolean).map(function(value) {
        return '<span class="result-tag">' + escapeHtml(value) + '</span>';
      }).join("");
      return '<a class="result-card" href="' + cardUrl(card) + '">' +
        (img ? '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(card.name) + ' card" loading="lazy" />' : "") +
        '<span><span class="result-name">' + escapeHtml(card.name) + '</span>' +
        '<span class="result-sub">' + escapeHtml([setName, card.number ? "#" + card.number : ""].filter(Boolean).join(" | ")) + '</span>' +
        (tags ? '<span class="result-tags">' + tags + '</span>' : "") +
        '</span></a>';
    }

    function renderPayload(payload) {
      const cards = payload.ok && Array.isArray(payload.data) ? payload.data : [];
      state.totalCount = Number(payload.totalCount || cards.length);
      if (!state.set && payload.defaultSet && payload.defaultSet.id && !state.q) {
        state.set = payload.defaultSet.id;
        setSelect.value = state.set;
        updateUrl();
      }
      resultsGrid.innerHTML = cards.map(renderCard).join("");
      if (cards.length) prefetchVisibleCardPages(cards);
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
      pageLabel.textContent = "Page " + state.page;
      prevPage.disabled = isLoading || state.page <= 1;
      nextPage.disabled = isLoading || state.page >= maxPage;
    }

    async function fetchCardsFor(nextState, options) {
      const key = cacheKey(nextState);
      if (resultCache.has(key)) return resultCache.get(key);
      const response = await fetch("/api/card-search?" + searchParamsFor(nextState).toString(), options);
      const payload = await response.json();
      if (resultCache.size > 40) resultCache.delete(resultCache.keys().next().value);
      resultCache.set(key, payload);
      return payload;
    }

    function prefetchNearby() {
      const maxPage = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
      const candidates = [];
      if (state.page < maxPage) candidates.push({ ...state, page: state.page + 1 });
      if (state.page > 1) candidates.push({ ...state, page: state.page - 1 });
      candidates.forEach(function(candidate) {
        const key = cacheKey(candidate);
        if (!resultCache.has(key)) {
          fetchCardsFor(candidate).catch(function() {});
        }
      });
    }

    async function loadSets() {
      const response = await fetch("/api/card-search?sets=1");
      const payload = await response.json();
      if (!payload.ok) return;
      setSelect.insertAdjacentHTML("beforeend", payload.data.map(function(set) {
        const label = set.releaseDate ? set.name + " (" + set.releaseDate.slice(0, 4) + ")" : set.name;
        return '<option value="' + escapeHtml(set.id) + '">' + escapeHtml(label) + '</option>';
      }).join(""));
      setSelect.value = state.set;
    }

    async function loadCards() {
      updateUrl();
      const key = cacheKey(state);
      activeRequestKey = key;

      if (resultCache.has(key)) {
        renderPayload(resultCache.get(key));
        setLoading(false);
        updateSetDeepLink();
        prefetchNearby();
        return;
      }

      if (activeController) activeController.abort();
      activeController = new AbortController();
      setLoading(true);
      resultSummary.textContent = resultsGrid.children.length ? "Updating cards..." : "Loading cards...";

      try {
        const payload = await fetchCardsFor(state, { signal: activeController.signal });
        if (activeRequestKey !== key) return;
        renderPayload(payload);
        updateSetDeepLink();
        prefetchNearby();
      } catch (error) {
        if (error.name === "AbortError") return;
        resultsGrid.innerHTML = "";
        emptyState.style.display = "block";
        resultSummary.textContent = "Search is unavailable";
      } finally {
        if (activeRequestKey === key) setLoading(false);
      }
    }

    queryInput.value = state.q;
    setSelect.value = state.set;
    updateSetDeepLink();
    loadSets().finally(loadCards);

    form.addEventListener("submit", function(event) {
      event.preventDefault();
      state.q = queryInput.value.trim();
      state.set = setSelect.value;
      state.page = 1;
      loadCards();
    });
    queryInput.addEventListener("input", function() {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(function() {
        state.q = queryInput.value.trim();
        state.page = 1;
        loadCards();
      }, 360);
    });
    setSelect.addEventListener("change", function() {
      state.set = setSelect.value;
      state.page = 1;
      loadCards();
    });
    prevPage.addEventListener("click", function() {
      if (state.page > 1) {
        state.page -= 1;
        loadCards();
      }
    });
    nextPage.addEventListener("click", function() {
      state.page += 1;
      loadCards();
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
  res.end(renderSearchPage(req));
};
