const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const APP_STORE_URL = "https://apps.apple.com/us/app/route-25-tcg-social-network/id6755665546";
const X_URL = "https://x.com/route25app";
const INSTAGRAM_URL = "https://www.instagram.com/route25app/";
const DISCORD_URL = "https://discord.gg/WncmGEFuNw";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function absoluteUrl(value, origin = "https://route25.app") {
  if (!value) return "";
  try {
    return new URL(value, origin).href;
  } catch {
    return "";
  }
}

function cardSetId(cardId) {
  const id = String(cardId || "").trim();
  const idx = id.lastIndexOf("-");
  return idx > 0 ? id.slice(0, idx) : "";
}

function route25CardId(cardId) {
  const id = String(cardId || "").trim();
  const setId = cardSetId(id);
  if (setId.toLowerCase() === "sv35") {
    return id.replace(/^sv35-/i, "sv3pt5-");
  }
  return id;
}

function pokemonText() {
  return "Pokemon";
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchCard(cardId) {
  const lookupCardId = route25CardId(cardId);
  const setId = cardSetId(lookupCardId);
  if (!setId) return null;

  let card = null;
  try {
    const bySetUrl = `${BACKEND_ORIGIN}/api/tcg/by-set?set=${encodeURIComponent(setId)}&pageSize=500`;
    const bySetPayload = await fetchJson(bySetUrl);
    const items = Array.isArray(bySetPayload.items) ? bySetPayload.items : [];
    const match = items.find((card) => String(card?.id || "").toLowerCase() === lookupCardId.toLowerCase());
    if (match) card = match;
  } catch {
    // Fall through to the seed endpoint below.
  }

  if (!card) {
    const seedUrl = `${BACKEND_ORIGIN}/api/seed/cards?set=${encodeURIComponent(setId)}&page=1&pageSize=500`;
    const seedPayload = await fetchJson(seedUrl);
    const seedItems = Array.isArray(seedPayload.data) ? seedPayload.data : [];
    card = seedItems.find((card) => String(card?.id || "").toLowerCase() === lookupCardId.toLowerCase()) || null;
  }

  if (!card) return null;
  return enrichCardSet(card, setId);
}

async function enrichCardSet(card, setId) {
  const currentName = String(card?.set?.name || "").trim();
  if (currentName && currentName.toLowerCase() !== setId.toLowerCase()) return card;

  try {
    const setsPayload = await fetchJson(`${BACKEND_ORIGIN}/api/tcg/sets`);
    const sets = Array.isArray(setsPayload.data) ? setsPayload.data : [];
    const set = sets.find((item) => String(item?.id || "").toLowerCase() === setId.toLowerCase());
    if (!set) return card;
    return {
      ...card,
      set: {
        ...set,
        ...(card.set || {}),
        name: set.name || card?.set?.name,
        images: {
          ...(set.images || {}),
          ...(card?.set?.images || {})
        }
      }
    };
  } catch {
    return card;
  }
}

function metaDescription(card) {
  const setName = card?.set?.name || card?.set?.id || "Pokemon TCG";
  const number = card?.number ? `#${card.number}` : card?.id;
  const rarity = card?.rarity ? `${card.rarity} ` : "";
  return `${card.name} ${number} from ${setName}. View card details, artwork, rarity, type, artist, and set information for this ${rarity}${pokemonText()} TCG card on Route 25.`;
}

function detailRows(card) {
  const rows = [
    ["Set", card?.set?.name || card?.set?.id],
    ["Card No.", card?.number],
    ["Rarity", card?.rarity],
    ["Type", Array.isArray(card?.types) ? card.types.join(", ") : null],
    ["Artist", card?.artist || card?.illustrator],
    ["National No.", Array.isArray(card?.nationalPokedexNumbers) ? card.nationalPokedexNumbers[0] : card?.nationalPokedexNumbers],
    ["Regulation", card?.regulationMark]
  ].filter(([, value]) => value);

  return rows.map(([label, value]) => `
    <div class="detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join("");
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
        </span>`;
}

function renderCardPage(card, req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "route25.app";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const pageUrl = `${proto}://${host}/cards/${encodeURIComponent(card.id)}`;
  const image = absoluteUrl(card?.images?.large || card?.images?.small, BACKEND_ORIGIN);
  const setLogo = absoluteUrl(card?.set?.images?.localLogo || card?.set?.images?.logo, BACKEND_ORIGIN);
  const setName = card?.set?.name || card?.set?.id || "Pokemon TCG";
  const cardNumber = card?.number ? ` #${card.number}` : "";
  const title = `${card.name}${cardNumber} ${setName} ${pokemonText()} Card | Route 25`;
  const description = metaDescription(card);
  const typeText = [card?.supertype, ...(Array.isArray(card?.subtypes) ? card.subtypes : [])].filter(Boolean).join(" / ");
  const flavorText = card?.flavorText ? `<blockquote>${escapeHtml(card.flavorText)}</blockquote>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="#05060a" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(image || "/assets/Icon.png")}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image || "/assets/Icon.png")}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/site.css" />
  <style>
    .card-share-hero {
      min-height: calc(100vh - 64px);
      padding: clamp(34px, 6vw, 72px) 0 48px;
      display: grid;
      align-items: center;
    }
    .card-share-grid {
      display: grid;
      grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr);
      gap: clamp(28px, 5vw, 72px);
      align-items: center;
    }
    .card-art-stage {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 560px;
    }
    .card-art-stage::before {
      content: "";
      position: absolute;
      inset: 9% 0 4%;
      border-radius: 999px;
      background:
        radial-gradient(circle at 38% 32%, rgba(88, 199, 255, 0.32), transparent 35%),
        radial-gradient(circle at 65% 74%, rgba(138, 93, 255, 0.34), transparent 40%),
        rgba(255, 255, 255, 0.04);
      filter: blur(10px);
      transform: rotate(-8deg);
    }
    .card-art {
      position: relative;
      width: min(100%, 420px);
      border-radius: 18px;
      filter: drop-shadow(0 34px 44px rgba(0, 0, 0, 0.58));
      transform: rotate(-2.5deg);
    }
    .card-copy {
      max-width: 620px;
    }
    .card-kicker {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .set-logo {
      max-height: 34px;
      max-width: 132px;
      object-fit: contain;
    }
    .card-copy h1 {
      font-size: clamp(52px, 8vw, 104px);
      line-height: 0.9;
      margin: 18px 0;
      max-width: 8ch;
    }
    .card-meta-line {
      color: var(--muted);
      font-size: clamp(17px, 2vw, 22px);
      line-height: 1.45;
      margin: 0 0 22px;
      max-width: 36ch;
    }
    .detail-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 28px 0;
    }
    .detail-row {
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.055);
    }
    .detail-row dt {
      color: rgba(255, 255, 255, 0.54);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 5px;
    }
    .detail-row dd {
      margin: 0;
      font-weight: 760;
    }
    blockquote {
      margin: 26px 0 0;
      padding-left: 18px;
      border-left: 3px solid rgba(88, 199, 255, 0.72);
      color: rgba(255, 255, 255, 0.78);
      font-size: 17px;
      line-height: 1.6;
    }
    .card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }
    @media (max-width: 820px) {
      .card-share-grid {
        grid-template-columns: 1fr;
      }
      .card-art-stage {
        min-height: auto;
        padding: 14px 0 8px;
      }
      .card-art {
        width: min(74vw, 320px);
        transform: rotate(-1.5deg);
      }
      .card-copy h1 {
        max-width: 10ch;
      }
      .detail-list {
        grid-template-columns: 1fr;
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
        <a class="button primary" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">Download</a>
      </nav>
    </div>
  </header>
  <main class="card-share-hero">
    <div class="container card-share-grid">
      <div class="card-art-stage">
        ${image ? `<img class="card-art" src="${escapeHtml(image)}" alt="${escapeHtml(card.name)} card" />` : ""}
      </div>
      <section class="card-copy">
        <div class="card-kicker">
          ${setLogo ? `<img class="set-logo" src="${escapeHtml(setLogo)}" alt="" />` : ""}
          <span>${escapeHtml(card?.set?.name || card?.set?.id || "Pokemon TCG")}</span>
        </div>
        <h1>${escapeHtml(card.name)}</h1>
        <p class="card-meta-line">${escapeHtml([typeText, card?.rarity, card?.number ? `Card #${card.number}` : null].filter(Boolean).join(" | "))}</p>
        <dl class="detail-list">${detailRows(card)}</dl>
        ${flavorText}
        <div class="card-actions">
          <a class="button primary" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">Get Route 25</a>
          <a class="button" href="/">Explore Route 25</a>
        </div>
      </section>
    </div>
  </main>
</body>
</html>`;
}

function renderNotFound(cardId) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Card not found | Route 25</title>
  <link rel="stylesheet" href="/assets/site.css" />
</head>
<body>
  <main class="hero">
    <div class="container">
      <p class="badge">Card not found</p>
      <h1>We could not find ${escapeHtml(cardId)}.</h1>
      <p class="lead">This card may not be available on the public Route 25 card pages yet.</p>
      <div class="hero-actions"><a class="button primary" href="/">Back to Route 25</a></div>
    </div>
  </main>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const cardId = String(req.query?.id || "").trim();
  if (!cardId) {
    res.statusCode = 404;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(renderNotFound(""));
    return;
  }

  try {
    const card = await fetchCard(cardId);
    if (!card) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(renderNotFound(cardId));
      return;
    }

    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "s-maxage=86400, stale-while-revalidate=604800");
    res.end(renderCardPage(card, req));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(renderNotFound(cardId));
  }
};
