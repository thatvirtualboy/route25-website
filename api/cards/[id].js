const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const APP_STORE_URL = "https://apps.apple.com/us/app/route-25-tcg-social-network/id6755665546";
const X_URL = "https://x.com/route25app";
const INSTAGRAM_URL = "https://www.instagram.com/route25app/";
const DISCORD_URL = "https://discord.gg/WncmGEFuNw";
const EBAY_CAMPAIGN_ID = "5339132958";
const APP_STORE_ID = "6755665546";

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

function appDeepLink(path) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `route25://${cleanPath}`;
}

function pokemonText() {
  return "Pokemon";
}

function formatCurrency(amount, currencyCode = "USD") {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currencyCode || "USD").toUpperCase(),
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function ebayAffiliateUrl(query, customId) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return "";
  const url = new URL("https://www.ebay.com/sch/i.html");
  url.searchParams.set("_nkw", trimmed);
  url.searchParams.set("mkevt", "1");
  url.searchParams.set("mkcid", "1");
  url.searchParams.set("mkrid", "711-53200-19255-0");
  url.searchParams.set("siteid", "0");
  url.searchParams.set("campid", EBAY_CAMPAIGN_ID);
  url.searchParams.set("toolid", "10001");
  if (customId) url.searchParams.set("customid", customId);
  return url.href;
}

function ebaySearchQuery(card) {
  return [
    card?.name,
    card?.number,
    card?.set?.name || card?.set?.id,
    "Pokemon card"
  ].filter(Boolean).join(" ");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: options.signal
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  let timeout = null;
  try {
    return await Promise.race([
      fetchJson(url, { signal: controller.signal }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          const error = new Error("Fetch timed out");
          error.name = "TimeoutError";
          reject(error);
        }, timeoutMs);
        if (typeof timeout.unref === "function") timeout.unref();
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function fallbackCardFromRequest(cardId, req) {
  const lookupCardId = route25CardId(cardId);
  const setId = cardSetId(lookupCardId);
  const number = String(req.query?.number || lookupCardId.slice(setId.length + 1) || "").trim();
  if (!setId || !number) return null;
  const imageSmall = absoluteUrl(String(req.query?.imageSmall || "").trim(), BACKEND_ORIGIN);
  const imageLarge = absoluteUrl(String(req.query?.imageLarge || "").trim(), BACKEND_ORIGIN);

  return {
    id: lookupCardId,
    name: String(req.query?.name || lookupCardId).trim(),
    number,
    rarity: String(req.query?.rarity || "").trim(),
    images: {
      small: imageSmall,
      large: imageLarge || imageSmall
    },
    set: {
      id: setId,
      name: String(req.query?.setName || setId).trim(),
      images: {}
    }
  };
}

async function fetchCard(cardId, timings = [], options = {}) {
  const lookupCardId = route25CardId(cardId);
  const setId = cardSetId(lookupCardId);
  if (!setId) return null;
  const allowBroadFallback = options.allowBroadFallback !== false;

  let card = null;
  let setCard = null;
  try {
    const startedAt = Date.now();
    const cardUrl = `${BACKEND_ORIGIN}/api/tcg/cards?q=${encodeURIComponent(`id:${lookupCardId}`)}&pageSize=1`;
    const cardPayload = await fetchJsonWithTimeout(cardUrl, 1800);
    timings.push(`direct;dur=${Date.now() - startedAt}`);
    const items = Array.isArray(cardPayload.data) ? cardPayload.data : [];
    const match = items.find((card) => String(card?.id || "").toLowerCase() === lookupCardId.toLowerCase());
    if (match) card = withTcgplayerCardVariants(match);
  } catch (error) {
    timings.push(`direct_${error.name === "AbortError" || error.name === "TimeoutError" ? "timeout" : "error"};dur=1800`);
    // Fall through to the broader set endpoints below.
  }

  if (!card && allowBroadFallback) {
    try {
      const startedAt = Date.now();
      setCard = await fetchCardFromSet(setId, lookupCardId);
      timings.push(`byset;dur=${Date.now() - startedAt}`);
      if (setCard) card = setCard;
    } catch (error) {
      timings.push(`byset_${error.name === "AbortError" || error.name === "TimeoutError" ? "timeout" : "error"};dur=1800`);
      // Fall through to the seed endpoint below.
    }
  }

  if (!card && allowBroadFallback) {
    try {
      const startedAt = Date.now();
      const seedUrl = `${BACKEND_ORIGIN}/api/seed/cards?set=${encodeURIComponent(setId)}&page=1&pageSize=500`;
      const seedPayload = await fetchJsonWithTimeout(seedUrl, 1800);
      timings.push(`seed;dur=${Date.now() - startedAt}`);
      const seedItems = Array.isArray(seedPayload.data) ? seedPayload.data : [];
      card = seedItems.find((card) => String(card?.id || "").toLowerCase() === lookupCardId.toLowerCase()) || null;
    } catch (error) {
      timings.push(`seed_${error.name === "AbortError" || error.name === "TimeoutError" ? "timeout" : "error"};dur=1800`);
    }
  }

  if (setCard) {
    card = {
      ...card,
      ...setCard,
      images: {
        ...(card?.images || {}),
        ...(setCard?.images || {})
      },
      set: {
        ...(card?.set || {}),
        ...(setCard?.set || {}),
        images: {
          ...(card?.set?.images || {}),
          ...(setCard?.set?.images || {})
        }
      }
    };
  }

  if (!card) return null;
  const enrichStartedAt = Date.now();
  const enrichedCard = await enrichCardSet(card, setId);
  timings.push(`enrich;dur=${Date.now() - enrichStartedAt}`);
  return enrichedCard;
}

async function fetchCardFromSet(setId, lookupCardId) {
  const bySetUrl = `${BACKEND_ORIGIN}/api/tcg/by-set?set=${encodeURIComponent(setId)}&pageSize=500`;
  const bySetPayload = await fetchJsonWithTimeout(bySetUrl, 1800);
  const items = Array.isArray(bySetPayload.items) ? bySetPayload.items : [];
  return items.find((card) => String(card?.id || "").toLowerCase() === lookupCardId.toLowerCase()) || null;
}

async function enrichCardSet(card, setId) {
  const currentSetId = String(card?.set?.id || "").trim();
  if (currentSetId && currentSetId.toLowerCase() !== setId.toLowerCase()) return card;
  if (
    card?.set?.name
    && (card?.set?.printedTotal || card?.set?.cardCount?.official || card?.printedTotal)
    && (card?.set?.images?.logo || card?.set?.images?.localLogo)
  ) {
    return card;
  }

  let enrichedCard = card;
  const needsOfficialSet = !(
    card?.set?.printedTotal
    || card?.set?.cardCount?.official
    || card?.printedTotal
  );

  const [setsResult, officialSetResult] = await Promise.allSettled([
    fetchJson(`${BACKEND_ORIGIN}/api/tcg/sets`),
    needsOfficialSet ? fetchOfficialSet(setId) : Promise.resolve(null)
  ]);

  if (setsResult.status === "fulfilled") {
    const sets = Array.isArray(setsResult.value?.data) ? setsResult.value.data : [];
    const set = sets.find((item) => String(item?.id || "").toLowerCase() === setId.toLowerCase());
    if (set) {
      enrichedCard = {
        ...enrichedCard,
        set: {
          ...set,
          ...(enrichedCard.set || {}),
          name: set.name || enrichedCard?.set?.name,
          images: {
            ...(set.images || {}),
            ...(enrichedCard?.set?.images || {})
          }
        }
      };
    }
  }

  if (officialSetResult.status === "fulfilled") {
    const officialSet = officialSetResult.value;
    if (officialSet) {
      enrichedCard = {
        ...enrichedCard,
        set: {
          ...officialSet,
          ...(enrichedCard.set || {}),
          printedTotal: officialSet.printedTotal || enrichedCard?.set?.printedTotal,
          images: {
            ...(officialSet.images || {}),
            ...(enrichedCard?.set?.images || {})
          }
        }
      };
    }
  }

  return enrichedCard;
}

function setCacheHeaders(res, value) {
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.setHeader("cdn-cache-control", value);
  res.setHeader("vercel-cdn-cache-control", value);
}

async function fetchOfficialSet(setId) {
  const payload = await fetchJson(`https://api.pokemontcg.io/v2/sets/${encodeURIComponent(setId)}`);
  return payload?.data || null;
}

function metaDescription(card) {
  const setName = card?.set?.name || card?.set?.id || "Pokemon TCG";
  const number = formatCardNumber(card) || (card?.number ? `#${card.number}` : card?.id);
  const rarity = card?.rarity ? `${card.rarity} ` : "";
  return `${card.name} ${number} from ${setName}. View card details, artwork, rarity, type, artist, and set information for this ${rarity}${pokemonText()} TCG card on Route 25.`;
}

function cardStructuredData(card, pageUrl, image, description, options = {}) {
  const setName = card?.set?.name || card?.set?.id || "Pokemon TCG";
  const offers = options.tcgcsvQuote
    ? {
        "@type": "Offer",
        price: Number(options.tcgcsvQuote.amount).toFixed(2),
        priceCurrency: String(options.tcgcsvQuote.currencyCode || "USD").toUpperCase(),
        availability: "https://schema.org/InStock",
        url: pageUrl
      }
    : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: `${card.name} ${setName} Pokemon TCG Card | Route 25`,
        description,
        image
      },
      {
        "@type": "Product",
        "@id": `${pageUrl}#card`,
        name: `${card.name} ${formatCardNumber(card) || card?.number || ""}`.trim(),
        description,
        image,
        category: "Pokemon TCG card",
        brand: { "@type": "Brand", name: "Pokemon Trading Card Game" },
        sku: card.id,
        offers
      },
      {
        "@type": "SoftwareApplication",
        name: "Route 25",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "iOS",
        url: "https://route25.app/",
        downloadUrl: APP_STORE_URL
      }
    ].filter(Boolean)
  };
}

function formatCardNumber(card) {
  const number = card?.number;
  const printedTotal = card?.set?.printedTotal
    || card?.set?.cardCount?.official
    || card?.printedTotal;
  if (!number) return "";
  return printedTotal ? `${number}/${printedTotal}` : String(number);
}

function detailRows(card, options = {}) {
  const cardNumber = formatCardNumber(card);
  const variantQuote = variantPricingQuote(options.selectedVariant);
  const tcgcsvValue = variantQuote
    ? formatCurrency(variantQuote.amount, variantQuote.currencyCode)
    : options.tcgcsvQuote
      ? formatCurrency(options.tcgcsvQuote.amount, options.tcgcsvQuote.currencyCode)
      : "";
  const showAsyncPrice = options.enableAsyncPricing === true;
  const rows = [
    ["Set", card?.set?.name || card?.set?.id],
    ["Card No.", cardNumber],
    ["Variant", options.selectedVariant?.label],
    ["Rarity", card?.rarity],
    ["Type", Array.isArray(card?.types) ? card.types.join(", ") : null],
    ["Artist", card?.artist || card?.illustrator],
    ["Regulation", card?.regulationMark],
    ["TCGPlayer Value", tcgcsvValue || (showAsyncPrice ? "Loading..." : null)],
    ["eBay", "Search eBay listings", options.ebayUrl, true]
  ].filter(([, value]) => value);

  return rows.map(([label, value, linkUrl, isExternal]) => `
    <div class="detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${label === "Variant"
        ? `<span id="selected-variant-label">${escapeHtml(value)}</span>`
        : label === "TCGPlayer Value"
          ? `<span id="selected-variant-price">${escapeHtml(value)}</span>`
          : linkUrl
        ? `<a class="detail-link" href="${escapeHtml(linkUrl)}" target="_blank" rel="nofollow sponsored noopener noreferrer">${escapeHtml(value)}${isExternal ? '<span class="external-link-icon" aria-hidden="true">↗</span>' : ""}<span class="sr-only"> Opens in a new tab</span></a>`
        : escapeHtml(value)}
      </dd>
    </div>
  `).join("");
}

function cardVariants(card) {
  return Array.isArray(card?.cardVariants)
    ? card.cardVariants.filter((variant) => variant?.id && variant?.label)
    : [];
}

function hasCardVariants(card) {
  return cardVariants(card).length > 0;
}

function hasFastCardVariants(card) {
  return cardVariants(card).length > 1;
}

function withTcgplayerCardVariants(card) {
  if (!card || hasCardVariants(card)) return card;
  const variants = variantsFromTcgplayerPrices(card);
  return variants.length ? { ...card, cardVariants: variants } : card;
}

function variantsFromTcgplayerPrices(card) {
  const cardId = String(card?.id || "").trim();
  const prices = card?.tcgplayer?.prices;
  if (!cardId || !prices || typeof prices !== "object") return [];

  const configs = [
    { key: "normal", suffix: "normal", label: "Normal", finish: "normal", kind: "master", isDefault: true },
    { key: "holofoil", suffix: "holo", label: "Holo", finish: "holo", kind: "master", isDefault: true },
    { key: "reverseHolofoil", suffix: "reverse-holo", label: "Reverse Holo", finish: "reverse_holo", kind: "additional" },
    { key: "1stEditionHolofoil", suffix: "first-edition-holo", label: "1st Edition Holo", finish: "first_edition_holo", kind: "master", isDefault: true },
    { key: "1stEditionNormal", suffix: "first-edition-normal", label: "1st Edition Normal", finish: "first_edition_normal", kind: "master", isDefault: true },
  ];

  return configs.flatMap((config) => {
    const price = pickTcgplayerPrice(prices[config.key]);
    if (!price) return [];
    return [{
      id: `${cardId}:${config.suffix}`,
      cardId,
      label: config.label,
      kind: config.kind,
      finish: config.finish,
      size: "standard",
      isDefault: config.isDefault,
      pricing: {
        marketUsd: price,
        updatedAt: typeof card?.tcgplayer?.updatedAt === "string" ? card.tcgplayer.updatedAt : undefined,
      },
    }];
  });
}

function pickTcgplayerPrice(price) {
  for (const key of ["market", "marketPrice", "mid", "midPrice", "low", "lowPrice"]) {
    const value = Number(price?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function selectedVariant(card, req) {
  const variants = cardVariants(card);
  if (!variants.length) return null;
  const requested = String(req.query?.variant || "").trim();
  if (requested) {
    const match = variants.find((variant) => String(variant.id) === requested);
    if (match) return match;
  }
  return variants.find((variant) => variant.isDefault === true) || variants[0];
}

function variantPricingQuote(variant) {
  const marketUsd = Number(variant?.pricing?.marketUsd);
  if (!Number.isFinite(marketUsd) || marketUsd <= 0) return null;
  return {
    amount: marketUsd,
    currencyCode: "USD"
  };
}

function variantChips(card, selected, fallbackQuote) {
  const variants = cardVariants(card);
  if (!variants.length) return "";
  const fallbackPrice = fallbackQuote ? formatCurrency(fallbackQuote.amount, fallbackQuote.currencyCode) : "";
  const chips = variants.map((variant) => {
    const isSelected = selected && variant.id === selected.id;
    const price = variantPricingQuote(variant);
    const formattedPrice = price ? formatCurrency(price.amount, price.currencyCode) : fallbackPrice;
    return `<button
      class="variant-chip${isSelected ? " active" : ""}"
      type="button"
      data-variant-id="${escapeHtml(variant.id)}"
      data-variant-label="${escapeHtml(variant.label)}"
      data-variant-price="${escapeHtml(formattedPrice)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >${escapeHtml(variant.label)}</button>`;
  }).join("");

  return `<div class="variant-chip-row" aria-label="Select card variant">${chips}</div>`;
}

function variantScript(cardId) {
  return `<script>
    (() => {
      const backendOrigin = "${BACKEND_ORIGIN}";
      const cardId = ${JSON.stringify(cardId)};
      const chips = Array.from(document.querySelectorAll(".variant-chip"));
      const variantLabel = document.getElementById("selected-variant-label");
      const variantPrice = document.getElementById("selected-variant-price");
      if (!variantPrice) return;
      const needsPricingFetch = chips.length
        ? chips.some((chip) => !chip.dataset.variantPrice)
        : (!variantPrice.textContent || variantPrice.textContent === "Loading...");
      const initialPrice = variantPrice.textContent || "";
      const priceCache = new Map();
      const runWhenIdle = (callback) => {
        if (!needsPricingFetch) return;
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(callback, { timeout: 1800 });
        } else {
          window.setTimeout(callback, 700);
        }
      };
      const formatUsd = (amount) => {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) return "";
        try {
          return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
        } catch {
          return "$" + value.toFixed(2);
        }
      };
      const fetchPrice = async (id) => {
        if (!id) return "";
        if (priceCache.has(id)) return priceCache.get(id);
        try {
          const response = await fetch(backendOrigin + "/api/pricing/" + encodeURIComponent(id), { headers: { accept: "application/json" } });
          const payload = await response.json();
          const formatted = payload && payload.ok && payload.data ? formatUsd(payload.data.marketUsd || payload.data.marketEur) : "";
          priceCache.set(id, formatted);
          return formatted;
        } catch {
          priceCache.set(id, "");
          return "";
        }
      };
      const hydrateChipPrice = async (chip) => {
        if (chip.dataset.variantPrice) return chip.dataset.variantPrice;
        const variantId = chip.dataset.variantId || "";
        const exact = await fetchPrice(variantId);
        const fallback = exact || await fetchPrice(cardId);
        chip.dataset.variantPrice = fallback;
        return fallback;
      };
      const setPriceForChip = async (chip, loadingText) => {
        const existing = chip.dataset.variantPrice || "";
        if (existing) {
          variantPrice.textContent = existing;
          return;
        }
        variantPrice.textContent = loadingText || "Loading...";
        const hydrated = await hydrateChipPrice(chip);
        if (chip.classList.contains("active")) {
          variantPrice.textContent = hydrated || "Price unavailable";
        }
      };
      if (!chips.length || !variantLabel) {
        if (needsPricingFetch) {
          runWhenIdle(() => fetchPrice(cardId).then((price) => {
            variantPrice.textContent = price || "Price unavailable";
          }));
        }
        return;
      }
      for (const chip of chips) {
        chip.addEventListener("click", () => {
          for (const item of chips) {
            item.classList.toggle("active", item === chip);
            item.setAttribute("aria-pressed", item === chip ? "true" : "false");
          }
          variantLabel.textContent = chip.dataset.variantLabel || "";
          setPriceForChip(chip, initialPrice || "Loading...");
          const url = new URL(window.location.href);
          url.searchParams.set("variant", chip.dataset.variantId || "");
          window.history.replaceState({}, "", url);
        });
        if (needsPricingFetch) {
          chip.addEventListener("mouseover", () => { hydrateChipPrice(chip); }, { once: true });
          chip.addEventListener("focus", () => { hydrateChipPrice(chip); }, { once: true });
        }
      }
      const active = chips.find((chip) => chip.classList.contains("active")) || chips[0];
      if (needsPricingFetch && active && !active.dataset.variantPrice) {
        runWhenIdle(() => setPriceForChip(active, initialPrice || "Loading..."));
      }
    })();
  </script>`;
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

function renderCardPage(card, req, options = {}) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "route25.app";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const pageUrl = `${proto}://${host}/cards/${encodeURIComponent(card.id)}`;
  const image = absoluteUrl(card?.images?.large || card?.images?.small, BACKEND_ORIGIN);
  const setLogo = absoluteUrl(card?.set?.images?.localLogo || card?.set?.images?.logo, BACKEND_ORIGIN);
  const setName = card?.set?.name || card?.set?.id || "Pokemon TCG";
  const browseSetId = card?.set?.id || cardSetId(card.id);
  const browseSetUrl = browseSetId ? `/sets/${encodeURIComponent(browseSetId)}` : "/search";
  const appCardUrl = appDeepLink(`cards/${card.id}`);
  const cardNumber = card?.number ? ` #${card.number}` : "";
  const setCardNumber = formatCardNumber(card);
  const title = `${card.name}${cardNumber} ${setName} ${pokemonText()} Card | Route 25`;
  const description = metaDescription(card);
  const typeText = [card?.supertype, ...(Array.isArray(card?.subtypes) ? card.subtypes : [])].filter(Boolean).join(" / ");
  const flavorText = card?.flavorText ? `<blockquote>${escapeHtml(card.flavorText)}</blockquote>` : "";
  const ebayUrl = ebayAffiliateUrl(ebaySearchQuery(card), `r25-card-${card.id}`);
  const selected = selectedVariant(card, req);
  const pageQuote = variantPricingQuote(selected) || options.tcgcsvQuote;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#05060a" />
  <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}, app-argument=${escapeHtml(appCardUrl)}" />
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
  <script type="application/ld+json">${jsonScript(cardStructuredData(card, pageUrl, image, description, { tcgcsvQuote: pageQuote }))}</script>
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
      max-height: 64px;
      max-width: 230px;
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
    .variant-chip-row {
      display: flex;
      flex-wrap: nowrap;
      gap: 8px;
      margin: -6px 0 22px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: thin;
    }
    .variant-chip {
      appearance: none;
      flex: 0 0 auto;
      padding: 8px 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      color: inherit;
      font: inherit;
      font-size: 13px;
      font-weight: 760;
      line-height: 1;
      background: rgba(5, 6, 10, 0.28);
      cursor: pointer;
    }
    .variant-chip:hover {
      border-color: rgba(88, 199, 255, 0.5);
      background: rgba(88, 199, 255, 0.08);
    }
    .variant-chip.active {
      border-color: rgba(255, 214, 82, 0.58);
      background: rgba(255, 214, 82, 0.1);
    }
    .detail-link {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      color: inherit;
      text-decoration: none;
    }
    .detail-link:hover {
      color: var(--accent);
    }
    .external-link-icon {
      font-size: 0.86em;
      line-height: 1;
      opacity: 0.72;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
    .community-cta {
      margin-top: clamp(28px, 5vw, 56px);
      padding: clamp(28px, 5vw, 44px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 22px;
      background:
        linear-gradient(135deg, rgba(88, 199, 255, 0.14), rgba(255, 214, 82, 0.12)),
        rgba(255, 255, 255, 0.055);
    }
    .community-cta h2 {
      font-size: clamp(30px, 4.4vw, 56px);
      line-height: 0.98;
      margin: 0 0 12px;
      max-width: 13ch;
    }
    .community-cta p {
      color: rgba(255, 255, 255, 0.74);
      font-size: clamp(16px, 1.6vw, 20px);
      line-height: 1.5;
      max-width: 48ch;
      margin: 0 0 22px;
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
      .set-logo {
        max-height: 54px;
        max-width: 190px;
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
      </nav>
    </div>
  </header>
  <main class="card-share-hero">
    <div class="container card-share-grid">
      <div class="card-art-stage">
        ${image ? `<img class="card-art" src="${escapeHtml(image)}" alt="${escapeHtml(card.name)} card" fetchpriority="high" decoding="async" />` : ""}
      </div>
      <section class="card-copy">
        <div class="card-kicker">
          ${setLogo ? `<img class="set-logo" src="${escapeHtml(setLogo)}" alt="" />` : ""}
          <span>${escapeHtml(card?.set?.name || card?.set?.id || "Pokemon TCG")}</span>
        </div>
        <h1>${escapeHtml(card.name)}</h1>
        <p class="card-meta-line">${escapeHtml([typeText, card?.rarity, setCardNumber ? `Card ${setCardNumber}` : null].filter(Boolean).join(" | "))}</p>
        ${variantChips(card, selected, options.tcgcsvQuote)}
        <dl class="detail-list">${detailRows(card, { tcgcsvQuote: options.tcgcsvQuote, ebayUrl, selectedVariant: selected, enableAsyncPricing: true })}</dl>
        ${flavorText}
        <div class="card-actions">
          <a class="button primary" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">Get Route 25</a>
          <a class="button" href="${escapeHtml(browseSetUrl)}">Browse this set</a>
          <a class="button" href="${escapeHtml(appCardUrl)}">Open this in Route 25</a>
        </div>
      </section>
    </div>
    <section class="container community-cta" aria-labelledby="community-cta-title">
      <h2 id="community-cta-title">Join a better ${pokemonText()} TCG community.</h2>
      <p>Track your collection, share pulls, talk trades, and connect with collectors who care about the cards as much as you do.</p>
      <div class="card-actions">
        <a class="button primary" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">Download Route 25</a>
        <a class="button" href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer">Join the Discord</a>
      </div>
    </section>
  </main>
  ${variantScript(card.id)}
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
    const startedAt = Date.now();
    const timings = [];
    let usedFallback = false;
    const hasRequestHints = Boolean(req.query?.name || req.query?.number || req.query?.setName || req.query?.rarity);
    let card = await fetchCard(cardId, timings, { allowBroadFallback: !hasRequestHints });
    if (!card) {
      card = fallbackCardFromRequest(cardId, req);
      usedFallback = Boolean(card);
      if (usedFallback) timings.push("fallback;dur=0");
    }
    if (!card) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("server-timing", timings.join(", "));
      res.end(renderNotFound(cardId));
      return;
    }

    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("server-timing", timings.join(", "));
    setCacheHeaders(res, usedFallback
      ? "public, s-maxage=30, stale-while-revalidate=300"
      : "public, s-maxage=86400, stale-while-revalidate=604800");
    const totalMs = Date.now() - startedAt;
    if (usedFallback || totalMs > 1500) {
      console.log(JSON.stringify({
        route: "card-detail",
        cardId,
        totalMs,
        usedFallback,
        timings
      }));
    }
    res.end(renderCardPage(card, req, { tcgcsvQuote: null }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(renderNotFound(cardId));
  }
};
