const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const APP_STORE_URL = "https://apps.apple.com/us/app/route-25-tcg-social-network/id6755665546";
const APP_STORE_ID = "6755665546";
const DISCORD_URL = "https://discord.gg/WncmGEFuNw";

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

function absoluteUrl(value, origin = "https://route25.app") {
  if (!value) return "";
  try {
    return new URL(value, origin).href;
  } catch {
    return "";
  }
}

function appDeepLink(path) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `route25://${cleanPath}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return response.json();
}

async function fetchSets() {
  const payload = await fetchJson(`${BACKEND_ORIGIN}/api/tcg/sets`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function fetchSet(setId) {
  const sets = await fetchSets();
  return sets.find((set) => String(set?.id || "").toLowerCase() === setId.toLowerCase()) || null;
}

async function fetchCards(setId) {
  const payload = await fetchJson(`${BACKEND_ORIGIN}/api/tcg/by-set?set=${encodeURIComponent(setId)}&pageSize=500`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.filter((card) => card?.id).slice(0, 500);
}

function cardImage(card) {
  return absoluteUrl(card?.images?.small || card?.images?.large, BACKEND_ORIGIN);
}

function setLogo(set) {
  return absoluteUrl(set?.images?.localLogo || set?.images?.logo || set?.images?.symbol, BACKEND_ORIGIN);
}

function setSymbol(set) {
  return absoluteUrl(set?.images?.localSymbol || set?.images?.symbol || set?.images?.logo, BACKEND_ORIGIN);
}

function setTotal(set, cards) {
  return set?.printedTotal || set?.cardCount?.official || set?.total || cards.length;
}

function releaseYear(set) {
  const year = new Date(String(set?.releaseDate || "")).getFullYear();
  return Number.isFinite(year) ? String(year) : "";
}

function renderCardGrid(cards) {
  return cards.slice(0, 36).map((card) => {
    const image = cardImage(card);
    const number = card?.number ? `#${card.number}` : card?.id;
    return `<a class="set-card" href="/cards/${encodeURIComponent(card.id)}" aria-label="${escapeHtml(card?.name || card.id)}">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(card?.name || "Pokemon card")}" loading="lazy" decoding="async" />` : ""}
      <span>${escapeHtml(card?.name || card.id)}</span>
      <small>${escapeHtml([number, card?.rarity].filter(Boolean).join(" | "))}</small>
    </a>`;
  }).join("");
}

function structuredData({ set, cards, pageUrl, image }) {
  const name = set?.name || set?.id || "Pokemon TCG set";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: `${name} Pokemon TCG Set | Route 25`,
        description: `${name} card list, set details, card pages, and collection tracking on Route 25.`,
        image
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#cards`,
        name: `${name} card list`,
        numberOfItems: cards.length,
        itemListElement: cards.slice(0, 50).map((card, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `https://route25.app/cards/${encodeURIComponent(card.id)}`,
          name: card?.name || card.id
        }))
      },
      {
        "@type": "SoftwareApplication",
        name: "Route 25",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "iOS",
        url: "https://route25.app/",
        downloadUrl: APP_STORE_URL
      }
    ]
  };
}

function renderSetPage(set, cards, req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "route25.app";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const pageUrl = `${proto}://${host}/sets/${encodeURIComponent(set.id)}`;
  const name = set?.name || set?.id || "Pokemon TCG";
  const year = releaseYear(set);
  const total = setTotal(set, cards);
  const logo = setLogo(set);
  const symbol = setSymbol(set);
  const heroImage = cardImage(cards[0]) || logo || symbol || "/assets/Icon.png";
  const appUrl = appDeepLink(`sets/${set.id}`);
  const title = `${name}${year ? ` (${year})` : ""} Pokemon TCG Set List, Cards & Prices | Route 25`;
  const description = `Browse ${name}${year ? ` (${year})` : ""} Pokemon TCG cards, set details, card images, values, and collection tools on Route 25.`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#05060a" />
  <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${escapeHtml(appUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(heroImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(heroImage)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/site.css" />
  <script type="application/ld+json">${jsonScript(structuredData({ set, cards, pageUrl, image: heroImage }))}</script>
  <style>
    .set-hero {
      min-height: calc(100vh - 64px);
      display: grid;
      align-items: center;
      padding: clamp(36px, 6vw, 82px) 0 46px;
    }
    .set-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, .86fr);
      gap: clamp(30px, 6vw, 82px);
      align-items: center;
    }
    .set-copy h1 {
      font-size: clamp(54px, 8vw, 108px);
      line-height: .9;
      letter-spacing: 0;
      margin: 18px 0;
      max-width: 9ch;
    }
    .set-mark {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .set-mark img {
      max-width: 160px;
      max-height: 56px;
      object-fit: contain;
    }
    .set-lead {
      color: var(--muted);
      font-size: clamp(18px, 2vw, 23px);
      line-height: 1.45;
      max-width: 42ch;
      margin: 0 0 28px;
    }
    .set-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin: 0 0 28px;
      max-width: 650px;
    }
    .set-stat {
      min-height: 86px;
      padding: 15px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.055);
    }
    .set-stat b {
      display: block;
      font-size: clamp(22px, 3vw, 34px);
      line-height: 1;
      margin-bottom: 7px;
    }
    .set-stat span {
      color: rgba(255,255,255,.56);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    .set-visual {
      position: relative;
      min-height: 560px;
      display: grid;
      place-items: center;
    }
    .set-visual::before {
      content: "";
      position: absolute;
      inset: 9% 0 4%;
      border-radius: 999px;
      background:
        radial-gradient(circle at 38% 32%, rgba(88,199,255,.30), transparent 35%),
        radial-gradient(circle at 65% 74%, rgba(138,93,255,.32), transparent 40%),
        rgba(255,255,255,.04);
      filter: blur(10px);
      transform: rotate(-8deg);
    }
    .set-card-stack {
      position: relative;
      width: min(100%, 460px);
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      align-items: end;
    }
    .set-card-stack img {
      width: 100%;
      aspect-ratio: 63 / 88;
      object-fit: cover;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.14);
      box-shadow: 0 26px 42px rgba(0,0,0,.46);
      background: rgba(255,255,255,.06);
    }
    .set-card-stack img:nth-child(1) {
      grid-column: span 2;
      border-radius: 20px;
      transform: rotate(-3deg);
      z-index: 2;
    }
    .set-card-stack img:nth-child(2) { transform: rotate(4deg) translateY(9%); }
    .set-card-stack img:nth-child(3) { transform: rotate(-2deg) translateY(-5%); }
    .set-card-stack img:nth-child(n+4) { display: none; }
    .set-card-section {
      padding: clamp(40px, 6vw, 78px) 0;
      border-top: 1px solid rgba(255,255,255,.1);
    }
    .set-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
      gap: 16px;
      margin-top: 26px;
    }
    .set-card {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .set-card:hover { text-decoration: none; }
    .set-card img {
      width: 100%;
      aspect-ratio: 63 / 88;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.06);
      box-shadow: 0 14px 30px rgba(0,0,0,.34);
      transition: transform 160ms ease, border-color 160ms ease;
    }
    .set-card:hover img {
      transform: translateY(-2px);
      border-color: rgba(88,199,255,.45);
    }
    .set-card span {
      font-weight: 780;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    .set-card small {
      color: var(--muted);
      line-height: 1.25;
    }
    @media (max-width: 860px) {
      .set-grid { grid-template-columns: 1fr; }
      .set-visual { min-height: auto; padding: 12px 0; }
      .set-card-stack { width: min(88vw, 400px); }
      .set-stats { grid-template-columns: 1fr; }
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
        <a href="/search?set=${encodeURIComponent(set.id)}">Search cards</a>
      </nav>
    </div>
  </header>
  <main>
    <section class="set-hero">
      <div class="container set-grid">
        <section class="set-copy">
          <div class="set-mark">
            ${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : ""}
            <span>${escapeHtml(set.id)}</span>
          </div>
          <h1>${escapeHtml(name)}</h1>
          <p class="set-lead">${escapeHtml(description)}</p>
          <div class="set-stats">
            <div class="set-stat"><b>${escapeHtml(String(total || cards.length))}</b><span>Cards</span></div>
            <div class="set-stat"><b>${escapeHtml(year || "TCG")}</b><span>Released</span></div>
            <div class="set-stat"><b>${escapeHtml(cards.length ? String(cards.length) : "Live")}</b><span>Indexed</span></div>
          </div>
          <div class="hero-actions">
            <a class="button primary" href="${escapeHtml(appUrl)}">Open this set in Route 25</a>
            <a class="button" href="/search?set=${encodeURIComponent(set.id)}">Search this set</a>
            <a class="button" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">Get Route 25</a>
          </div>
        </section>
        <div class="set-visual" aria-hidden="true">
          <div class="set-card-stack">
            ${cards.slice(0, 4).map((card) => {
              const image = cardImage(card);
              return image ? `<img src="${escapeHtml(image)}" alt="" loading="eager" decoding="async" />` : "";
            }).join("")}
          </div>
        </div>
      </div>
    </section>
    <section class="set-card-section">
      <div class="container">
        <h2 class="section-title">${escapeHtml(name)} card list</h2>
        <p class="section-subtitle">Browse individual card pages for artwork, rarity, card numbers, TCGPlayer values, and collection context.</p>
        <div class="set-card-grid">${renderCardGrid(cards)}</div>
      </div>
    </section>
    <section class="container community-cta" aria-labelledby="set-community-title">
      <h2 id="set-community-title">Manage this set in Route 25.</h2>
      <p>Track your binder, view card values, share pulls, and keep your Pokemon TCG collection moving.</p>
      <div class="card-actions">
        <a class="button primary" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">Download Route 25</a>
        <a class="button" href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer">Join the Discord</a>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function renderNotFound(setId) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Set not found | Route 25</title>
  <link rel="stylesheet" href="/assets/site.css" />
</head>
<body>
  <main class="hero">
    <div class="container">
      <p class="badge">Set not found</p>
      <h1>We could not find ${escapeHtml(setId)}.</h1>
      <p class="lead">This set may not be available on the public Route 25 set pages yet.</p>
      <div class="hero-actions"><a class="button primary" href="/search">Search cards</a></div>
    </div>
  </main>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const setId = String(req.query?.id || "").trim();
  if (!setId) {
    res.statusCode = 404;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(renderNotFound(""));
    return;
  }

  try {
    const set = await fetchSet(setId);
    if (!set) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(renderNotFound(setId));
      return;
    }

    const cards = await fetchCards(set.id);
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "s-maxage=86400, stale-while-revalidate=604800");
    res.end(renderSetPage(set, cards, req));
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(renderNotFound(setId));
  }
};
