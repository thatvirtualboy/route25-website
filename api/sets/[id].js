const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const APP_STORE_URL = "https://apps.apple.com/us/app/route-25-tcg-social-network/id6755665546";
const APP_STORE_ID = "6755665546";
const DISCORD_URL = "https://discord.gg/WncmGEFuNw";
const X_URL = "https://x.com/route25app";
const INSTAGRAM_URL = "https://www.instagram.com/route25app/";

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

function tcgplayerProductId(card) {
  const variants = Array.isArray(card?.cardVariants) ? card.cardVariants : [];
  for (const variant of variants) {
    const productId = variant?.sourceRefs?.tcgplayerProductId;
    if (productId) return productId;
  }
  return null;
}

function cardImage(card) {
  if (String(card?.set?.id || "").toLowerCase() === "mep" || String(card?.id || "").toLowerCase().startsWith("mep-")) {
    const productId = tcgplayerProductId(card);
    if (productId) {
      return `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_200w.jpg`;
    }
  }

  const image = card?.images?.small || card?.images?.large;
  if (image) return absoluteUrl(image, BACKEND_ORIGIN);
  if (String(card?.set?.id || "").toLowerCase() !== "mep" && !String(card?.id || "").toLowerCase().startsWith("mep-")) return "";

  const id = String(card?.id || "");
  const number = String(card?.number || "").padStart(3, "0");
  const imageKey = id.toLowerCase().startsWith("mep-") ? id.slice(4) : number;
  return imageKey ? `${BACKEND_ORIGIN}/card-images/mep/mep-${imageKey}.webp` : "";
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

function rarityCount(cards) {
  const rarities = new Set(cards.map((card) => String(card?.rarity || "").trim()).filter(Boolean));
  return rarities.size;
}

function renderCardGrid(cards) {
  return cards.map((card) => {
    const image = cardImage(card);
    const number = card?.number ? `#${card.number}` : card?.id;
    return `<a class="set-card" href="/cards/${encodeURIComponent(card.id)}" aria-label="${escapeHtml(card?.name || card.id)}">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(card?.name || "Pokemon card")}" loading="lazy" decoding="async" />` : ""}
      <span>${escapeHtml(card?.name || card.id)}</span>
      <small>${escapeHtml([number, card?.rarity].filter(Boolean).join(" | "))}</small>
    </a>`;
  }).join("");
}

function socialToolbar() {
  return `<span class="social-toolbar" aria-label="Route 25 social links">
          <a href="${X_URL}" target="_blank" rel="noopener noreferrer" aria-label="Route 25 on X" class="social-link x-link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.504 11.24h-6.66l-5.213-6.817-5.966 6.817H1.68l7.73-8.835L1.25 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="${INSTAGRAM_URL}" target="_blank" rel="noopener noreferrer" aria-label="Route 25 on Instagram" class="social-link instagram-link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.25-.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </a>
          <a href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer" aria-label="Route 25 on Discord" class="social-link discord-link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.369A19.79 19.79 0 0 0 15.36 2.84a13.44 13.44 0 0 0-.635 1.313 18.34 18.34 0 0 0-5.45 0 12.53 12.53 0 0 0-.645-1.313 19.74 19.74 0 0 0-4.958 1.53C.535 9.045-.319 13.61.099 18.112a19.9 19.9 0 0 0 6.073 3.049 14.64 14.64 0 0 0 1.303-2.104 12.86 12.86 0 0 1-2.048-.975c.172-.126.34-.257.5-.391 3.948 1.82 8.23 1.82 12.13 0 .164.134.332.265.5.391-.65.385-1.337.712-2.054.978.373.735.81 1.438 1.304 2.101a19.86 19.86 0 0 0 6.077-3.05c.49-5.22-.839-9.742-3.567-13.742ZM8.02 15.332c-1.18 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.974 0c-1.18 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/>
            </svg>
          </a>
          <a href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer" aria-label="Download Route 25 on the App Store" class="social-link app-store-link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16.365 1.43c0 1.14-.421 2.139-1.264 2.996-.882.892-1.913 1.405-3.016 1.322-.132-1.088.438-2.23 1.222-3.035C14.172 1.824 15.598 1.155 16.365 1.43ZM20.509 17.37c-.538 1.235-.797 1.785-1.489 2.876-.968 1.488-2.332 3.344-4.018 3.36-1.498.014-1.884-.986-3.918-.975-2.034.01-2.458.993-3.957.979-1.687-.016-2.974-1.69-3.943-3.178-2.706-4.15-2.99-9.02-1.319-11.61 1.188-1.838 3.064-2.914 4.829-2.914 1.797 0 2.927.986 4.415.986 1.443 0 2.322-.988 4.403-.988 1.574 0 3.24.858 4.424 2.34-3.886 2.13-3.254 7.677.573 9.124Z"/>
            </svg>
          </a>
        </span>`;
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
  const rarities = rarityCount(cards);
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
        ${socialToolbar()}
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
            <div class="set-stat"><b>${escapeHtml(rarities ? String(rarities) : "Live")}</b><span>Rarities</span></div>
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
        <p class="section-subtitle">Browse artwork, rarity, card numbers, TCGPlayer values, and collection context for this set.</p>
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
