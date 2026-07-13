const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const APP_STORE_URL = "https://apps.apple.com/us/app/route-25-tcg-social-network/id6755665546";
const X_URL = "https://x.com/route25app";
const INSTAGRAM_URL = "https://www.instagram.com/route25app/";
const DISCORD_URL = "https://discord.gg/WncmGEFuNw";
const EBAY_CAMPAIGN_ID = "5339132958";
const TCGPLAYER_PROMOTION_URL = "https://partner.tcgplayer.com/c/6678178/1780961/21018";
const TCGPLAYER_SEARCH_API_URL = "https://mp-search-api.tcgplayer.com/v1/search/request";
const APP_STORE_ID = "6755665546";
const SOCIAL_PREVIEW_VERSION = "2";
const { route25ImageUrl } = require("../../lib/route25-image-url");
const tcgplayerResolveCache = new Map();
const {
  tcgplayerProductOverride,
  withTcgplayerProductOverride
} = require("../tcgplayer-overrides");

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

function tcgplayerProductIds(card) {
  const ids = [];
  const variants = Array.isArray(card?.cardVariants) ? card.cardVariants : [];
  for (const variant of variants) {
    const productId = variant?.sourceRefs?.tcgplayerProductId;
    if (productId && !ids.includes(productId)) ids.push(productId);
  }
  return ids;
}

function resolvedCardImages(card, large = true) {
  const candidates = [];
  const id = String(card?.id || "");
  if (id.toLowerCase() === "mep-500") {
    candidates.push(`${BACKEND_ORIGIN}/card-images/mep/mep-500.webp`);
  }

  if (String(card?.set?.id || cardSetId(card?.id)).toLowerCase() === "mep" || String(card?.id || "").toLowerCase().startsWith("mep-")) {
    for (const productId of tcgplayerProductIds(card)) {
      candidates.push(`https://tcgplayer-cdn.tcgplayer.com/product/${productId}${large ? "_in_1000x1000" : "_200w"}.jpg`);
    }
  }

  const image = large
    ? (card?.images?.large || card?.images?.small)
    : (card?.images?.small || card?.images?.large);
  if (image) candidates.push(absoluteUrl(image, BACKEND_ORIGIN));
  if (String(card?.set?.id || cardSetId(card?.id)).toLowerCase() !== "mep" && !String(card?.id || "").toLowerCase().startsWith("mep-")) {
    return candidates.filter((candidate, index) => candidate && candidates.indexOf(candidate) === index);
  }

  const number = String(card?.number || "").padStart(3, "0");
  const imageKey = id.toLowerCase().startsWith("mep-") ? id.slice(4) : number;
  if (imageKey) candidates.push(`${BACKEND_ORIGIN}/card-images/mep/mep-${imageKey}.webp`);
  return candidates.filter((candidate, index) => candidate && candidates.indexOf(candidate) === index);
}

function resolvedCardImage(card, large = true) {
  return resolvedCardImages(card, large)[0] || "";
}

function imageFallbackAttribute(candidates) {
  return candidates.length > 1
    ? ` data-fallbacks="${escapeHtml(candidates.slice(1).join("|"))}" onerror="route25CardImageFallback(this)"`
    : "";
}

function imageUpgradeAttribute(candidates, initialImage) {
  const upgradeCandidates = candidates.filter((candidate) => candidate && candidate !== initialImage);
  return upgradeCandidates.length
    ? ` data-hires-candidates="${escapeHtml(upgradeCandidates.join("|"))}"`
    : "";
}

function titleCaseSlug(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function manualPromoCard(cardId) {
  const id = String(cardId || "").trim();
  const cards = {
    "basep-ancient-mew": {
      id: "basep-ancient-mew",
      name: "Ancient Mew",
      number: "No. 001",
      rarity: "Promo",
      supertype: "Pokemon",
      subtypes: ["Basic"],
      types: ["Psychic"],
      images: {
        small: "https://static.tcgcollector.com/content/images/4e/72/3b/4e723beab389aad8ad532e80f3228d6257a5b5e72240e9489502b1453c1e1346.jpg",
        large: "https://static.tcgcollector.com/content/images/4e/72/3b/4e723beab389aad8ad532e80f3228d6257a5b5e72240e9489502b1453c1e1346.jpg"
      },
      set: {
        id: "basep-ancient",
        name: "Miscellaneous Promos",
        printedTotal: "001",
        images: {}
      }
    }
  };
  return cards[id.toLowerCase()] || null;
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

function requestOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "route25.app";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

function socialShareParam(query = {}) {
  for (const key of ["share", "preview", "v"]) {
    const value = String(query[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function cardSocialImageUrl(req, cardId) {
  const url = new URL("/api/cards/og", requestOrigin(req));
  url.searchParams.set("id", cardId);
  url.searchParams.set("v", socialShareParam(req.query) || SOCIAL_PREVIEW_VERSION);
  if (req.query?.variant) url.searchParams.set("variant", String(req.query.variant));
  return url.href;
}

function cardPageUrl(req, cardId) {
  const url = new URL(`/cards/${encodeURIComponent(cardId)}`, requestOrigin(req));
  if (req.query?.variant) url.searchParams.set("variant", String(req.query.variant));
  const share = socialShareParam(req.query);
  if (share) url.searchParams.set("share", share);
  return url.href;
}

function pokemonText() {
  return "Pokemon";
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  if (!text || /^(none|null|undefined|n\/a)$/i.test(text)) return "";
  return text;
}

function listText(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(", ");
  return cleanText(value);
}

function formatDate(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function formatWeaknesses(items) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => [item?.type, item?.value].map(cleanText).filter(Boolean).join(" ")).filter(Boolean).join(", ");
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

function selectedTcgplayerProductId(card, selectedVariant) {
  const selectedProductId = selectedVariant?.sourceRefs?.tcgplayerProductId;
  if (selectedProductId) return selectedProductId;
  const overrideProductId = tcgplayerProductOverride(card)?.productId;
  if (overrideProductId) return overrideProductId;
  return tcgplayerProductIds(card)[0] || "";
}

function normalizeLookupText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim();
}

function normalizeCardNumber(value) {
  const text = String(value || "").toLowerCase();
  const match = text.match(/[a-z]*0*([0-9]+)[a-z]*/);
  return match ? match[1] : text.replace(/^0+/, "");
}

function tcgplayerSetUrlValue(card) {
  const setId = String(card?.set?.id || cardSetId(card?.id) || "").toLowerCase();
  const setName = tcgplayerSlugPart(card?.set?.name || "");
  if (!setId || !setName) return "";
  const meMatch = setId.match(/^me(\d+)$/);
  if (meMatch) return `me${meMatch[1].padStart(2, "0")}-${setName}`;
  if (/^sv\d+$/i.test(setId)) return `${setId}-${setName}`;
  return `${setId}-${setName}`;
}

function productNumberMatches(card, product) {
  const cardNumber = normalizeCardNumber(card?.number);
  if (!cardNumber) return false;
  const productNumber = normalizeCardNumber(product?.customAttributes?.number || product?.productName || "");
  return productNumber === cardNumber;
}

function productNameMatches(card, product) {
  const cardName = normalizeLookupText(card?.name);
  if (!cardName) return false;
  const productName = normalizeLookupText(String(product?.productName || "").replace(/\s+-\s+[0-9a-z/]+$/i, ""));
  return productName === cardName || productName.includes(cardName) || cardName.includes(productName);
}

async function resolveTcgplayerProduct(card, timings = []) {
  if (tcgplayerProductIds(card).length) return card;
  const setUrlValue = tcgplayerSetUrlValue(card);
  if (!setUrlValue) return card;
  const cacheKey = `${setUrlValue}:${normalizeCardNumber(card?.number)}:${normalizeLookupText(card?.name)}`;
  const cached = tcgplayerResolveCache.get(cacheKey);
  if (cached === null) return card;
  if (cached) return withTcgplayerProductOverride({
    ...card,
    cardVariants: [cached, ...(Array.isArray(card.cardVariants) ? card.cardVariants : [])]
  });

  const startedAt = Date.now();
  try {
    for (let from = 0; from <= 144; from += 24) {
      const payload = await fetchJsonWithTimeout(TCGPLAYER_SEARCH_API_URL, 1000, {
        method: "POST",
        body: JSON.stringify({
          algorithm: "salesrel",
          from,
          size: 24,
          filters: {
            term: {
              productLineName: ["pokemon"],
              setName: [setUrlValue],
              productTypeName: ["Cards"]
            }
          },
          query: [card?.name, card?.number, card?.set?.name, "Pokemon"].filter(Boolean).join(" ")
        })
      });
      const result = Array.isArray(payload?.results) ? payload.results[0] : null;
      const products = Array.isArray(result?.results) ? result.results : [];
      const match = products.find((product) => productNumberMatches(card, product) && productNameMatches(card, product));
      if (match?.productId) {
        const variant = {
          id: `${card.id}:tcgplayer`,
          cardId: card.id,
          label: "TCGPlayer",
          kind: "master",
          isDefault: true,
          sourceRefs: {
            tcgplayerProductId: String(Math.trunc(Number(match.productId))),
            tcgplayerSlug: match.productUrlName ? tcgplayerSlugPart(match.productUrlName) : undefined
          },
          pricing: Number(match.marketPrice) > 0 ? { marketUsd: Number(match.marketPrice) } : undefined
        };
        tcgplayerResolveCache.set(cacheKey, variant);
        timings.push(`tcgplayer_resolve;dur=${Date.now() - startedAt}`);
        return {
          ...card,
          cardVariants: [variant, ...(Array.isArray(card.cardVariants) ? card.cardVariants : [])]
        };
      }
      if (!products.length || from + 24 >= Number(result?.totalResults || 0)) break;
    }
  } catch (error) {
    timings.push(`tcgplayer_resolve_${error.name === "AbortError" || error.name === "TimeoutError" ? "timeout" : "error"};dur=${Date.now() - startedAt}`);
    return card;
  }
  tcgplayerResolveCache.set(cacheKey, null);
  timings.push(`tcgplayer_resolve_miss;dur=${Date.now() - startedAt}`);
  return card;
}

function tcgplayerSearchQuery(card) {
  return [
    card?.name,
    card?.number,
    card?.set?.name || card?.set?.id,
    "Pokemon"
  ].filter(Boolean).join(" ");
}

function tcgplayerSlugPart(value) {
  return String(value || "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)?.join("-") || "";
}

function tcgplayerProductSlug(card) {
  const set = card?.set || {};
  const setPrefix = /^sv/i.test(String(set.id || "")) ? "sv" : "";
  const setPart = [setPrefix, set.series, set.name].map(tcgplayerSlugPart).filter(Boolean).join("-");
  const numberPart = [card?.number, set.printedTotal || set.cardCount?.official || card?.printedTotal]
    .map(tcgplayerSlugPart)
    .filter(Boolean)
    .join("-");
  return [
    "pokemon",
    setPart,
    tcgplayerSlugPart(card?.name),
    numberPart
  ].filter(Boolean).join("-");
}

function tcgplayerProductUrl(productId, card, selectedVariant) {
  const slug = selectedVariant?.sourceRefs?.tcgplayerSlug || tcgplayerProductOverride(card)?.slug || tcgplayerProductSlug(card);
  const url = new URL(`https://www.tcgplayer.com/product/${encodeURIComponent(productId)}${slug ? `/${slug}` : ""}`);
  url.searchParams.set("page", "1");
  url.searchParams.set("Language", "English");
  return url.href;
}

function tcgplayerAffiliateUrl(card, selectedVariant) {
  const productId = selectedTcgplayerProductId(card, selectedVariant);
  const destination = productId
    ? tcgplayerProductUrl(productId, card, selectedVariant)
    : (() => {
        const url = new URL("https://www.tcgplayer.com/search/pokemon/product");
        url.searchParams.set("productLineName", "pokemon");
        url.searchParams.set("q", tcgplayerSearchQuery(card));
        url.searchParams.set("view", "grid");
        return url.href;
      })();
  const url = new URL(TCGPLAYER_PROMOTION_URL);
  url.searchParams.set("u", destination);
  url.searchParams.set("subId1", "affiliate");
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
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {})
    },
    body: options.body,
    signal: options.signal
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchJsonWithTimeout(url, timeoutMs, fetchOptions = {}) {
  const controller = new AbortController();
  let timeout = null;
  try {
    return await Promise.race([
      fetchJson(url, { ...fetchOptions, signal: controller.signal }),
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
  const manualCard = manualPromoCard(lookupCardId);
  if (manualCard) return manualCard;
  const setId = cardSetId(lookupCardId);
  const slugNumber = lookupCardId.slice(setId.length + 1);
  const number = String(req.query?.number || slugNumber || "").trim();
  if (!setId || !number) return null;
  const imageSmall = absoluteUrl(String(req.query?.imageSmall || "").trim(), BACKEND_ORIGIN);
  const imageLarge = absoluteUrl(String(req.query?.imageLarge || "").trim(), BACKEND_ORIGIN);
  const imageFallbacks = String(req.query?.imageFallbacks || "")
    .split("|")
    .map((url) => absoluteUrl(url.trim(), BACKEND_ORIGIN))
    .filter(Boolean);
  const fallbackName = titleCaseSlug(slugNumber || lookupCardId);
  const tcgplayerProductId = queryText(req.query, "tcgplayerProductId") || tcgplayerProductOverride(lookupCardId)?.productId;

  return withTcgplayerProductOverride({
    id: lookupCardId,
    name: queryText(req.query, "name") || fallbackName || lookupCardId,
    number,
    hp: queryText(req.query, "hp"),
    rarity: queryText(req.query, "rarity"),
    supertype: queryText(req.query, "supertype"),
    subtypes: queryList(req.query?.subtypes),
    types: queryList(req.query?.types),
    artist: queryText(req.query, "artist"),
    illustrator: queryText(req.query, "illustrator"),
    flavorText: queryText(req.query, "flavorText"),
    attacks: Array.isArray(queryJson(req.query?.attacks, [])) ? queryJson(req.query?.attacks, []) : [],
    abilities: Array.isArray(queryJson(req.query?.abilities, [])) ? queryJson(req.query?.abilities, []) : [],
    weaknesses: Array.isArray(queryJson(req.query?.weaknesses, [])) ? queryJson(req.query?.weaknesses, []) : [],
    resistances: Array.isArray(queryJson(req.query?.resistances, [])) ? queryJson(req.query?.resistances, []) : [],
    retreatCost: queryList(req.query?.retreatCost),
    convertedRetreatCost: queryText(req.query, "convertedRetreatCost"),
    regulationMark: queryText(req.query, "regulationMark"),
    legalities: queryJson(req.query?.legalities, undefined),
    cardVariants: tcgplayerProductId ? [{
      id: `${lookupCardId}:tcgplayer`,
      cardId: lookupCardId,
      label: "TCGPlayer",
      sourceRefs: { tcgplayerProductId },
      isDefault: true
    }] : [],
    images: {
      small: imageSmall,
      large: imageLarge || imageSmall,
      fallbacks: imageFallbacks
    },
    set: {
      id: setId,
      name: queryText(req.query, "setName") || setId,
      images: {}
    }
  });
}

function hasRequestHints(query = {}) {
  return Boolean(
    query.name
    || query.number
    || query.setName
    || query.rarity
    || query.imageLarge
    || query.imageSmall
  );
}

function cleanCardPath(cardId, query = {}) {
  const url = new URL(`/cards/${encodeURIComponent(cardId)}`, "https://route25.app");
  if (query.variant) url.searchParams.set("variant", String(query.variant));
  return url.pathname + url.search;
}

function queryText(query, key) {
  return String(query?.[key] || "").trim();
}

function queryList(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function queryJson(value, fallback) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchCard(cardId, timings = [], options = {}) {
  const lookupCardId = route25CardId(cardId);
  const setId = cardSetId(lookupCardId);
  if (!setId) return null;
  const manualCard = manualPromoCard(lookupCardId);
  if (manualCard) {
    timings.push("manual;dur=0");
    return manualCard;
  }
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

  if (allowBroadFallback && card && !tcgplayerProductIds(card).length) {
    try {
      const startedAt = Date.now();
      setCard = await fetchCardFromSet(setId, lookupCardId);
      timings.push(`byset_supplement;dur=${Date.now() - startedAt}`);
    } catch (error) {
      timings.push(`byset_supplement_${error.name === "AbortError" || error.name === "TimeoutError" ? "timeout" : "error"};dur=1800`);
    }
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
    const cardHasTcgplayerProduct = tcgplayerProductIds(card).length > 0;
    card = {
      ...setCard,
      ...card,
      cardVariants: cardHasTcgplayerProduct ? card.cardVariants : (setCard.cardVariants || card.cardVariants),
      images: {
        ...(setCard?.images || {}),
        ...(card?.images || {})
      },
      set: {
        ...(setCard?.set || {}),
        ...(card?.set || {}),
        images: {
          ...(setCard?.set?.images || {}),
          ...(card?.set?.images || {})
        }
      }
    };
  }

  if (!card) return null;
  card = withTcgplayerProductOverride(card);
  const enrichStartedAt = Date.now();
  const enrichedCard = await enrichCardSet(card, setId);
  timings.push(`enrich;dur=${Date.now() - enrichStartedAt}`);
  const resolvedCard = await resolveTcgplayerProduct(withTcgplayerProductOverride(enrichedCard), timings);
  return withTcgplayerProductOverride(resolvedCard);
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
    fetchJsonWithTimeout(`${BACKEND_ORIGIN}/api/tcg/sets`, 1200),
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
  const payload = await fetchJsonWithTimeout(`https://api.pokemontcg.io/v2/sets/${encodeURIComponent(setId)}`, 1200);
  return payload?.data || null;
}

function metaDescription(card) {
  const setName = card?.set?.name || card?.set?.id || "Pokemon TCG";
  const number = formatCardNumber(card) || (card?.number ? `#${card.number}` : card?.id);
  const rarity = cleanText(card?.rarity) ? `${cleanText(card.rarity)} ` : "";
  return `${card.name} ${number} from ${setName}. View card details, artwork, rarity, type, artist, and set information for this ${rarity}${pokemonText()} TCG card on Route 25.`;
}

function cardSeoProfile(card) {
  const name = cleanText(card?.name) || "Pokemon card";
  const setName = cleanText(card?.set?.name || card?.set?.id) || "Pokemon TCG";
  const fullNumber = formatCardNumber(card) || cleanText(card?.number || card?.id);
  const rarity = cleanText(card?.rarity);
  const artist = cleanText(card?.artist || card?.illustrator);
  const cardLabel = `${name}${fullNumber ? ` ${fullNumber}` : ""}`;
  const rarityText = rarity ? `${rarity} ` : "";

  if (String(card?.id || "").toLowerCase() !== "me4-116") {
    return {
      title: `${cardLabel} — ${setName} Pokemon Card | Route 25`,
      description: `${cardLabel} from ${setName}. View the ${rarityText}Pokemon TCG card, artwork, card text, artist, set details, and current value on Route 25.`,
      heading: `${cardLabel} card guide`,
      summary: `${cardLabel} is a ${rarityText}card from ${setName}${artist ? `, illustrated by ${artist}` : ""}.`,
      facts: [],
      faqs: []
    };
  }
  return {
    title: "Mega Greninja ex 116/086 — Chaos Rising Card Guide | Route 25",
    description: "Mega Greninja ex 116/086 from Pokemon TCG: Mega Evolution—Chaos Rising. See the Special Illustration Rare artwork, card text, artist, set details, and current value.",
    summary: "Mega Greninja ex 116/086 is a Special Illustration Rare from Pokemon TCG: Mega Evolution—Chaos Rising, illustrated by Susumu Maeya. It is one of the set's signature chase cards and completes a connected-art scene with Froakie and Frogadier.",
    heading: "Mega Greninja ex 116/086 card guide",
    facts: [
      ["Full card number", "116/086"],
      ["Expansion", "Mega Evolution—Chaos Rising"],
      ["Rarity", "Special Illustration Rare (SIR)"],
      ["Illustrator", "Susumu Maeya"],
      ["Release date", "May 22, 2026"]
    ],
    faqs: [
      ["What set is Mega Greninja ex 116/086 from?", "Mega Greninja ex 116/086 is from Pokemon TCG: Mega Evolution—Chaos Rising, released May 22, 2026."],
      ["What rarity is Mega Greninja ex 116/086?", "It is a Special Illustration Rare, commonly abbreviated SIR."],
      ["Who illustrated Mega Greninja ex 116/086?", "The card was illustrated by Susumu Maeya. Its artwork connects horizontally with the Froakie and Frogadier illustration rares from Chaos Rising."],
      ["What does Mega Greninja ex do?", "Its Mortal Shuriken Ability places six damage counters on one of the opponent's Pokemon after a Basic Water Energy is discarded, while Ninja Spinner does 120 damage plus 80 more when a Water Energy attached to Mega Greninja ex is returned to the hand."]
    ]
  };
}

function cardStructuredData(card, pageUrl, image, description, seoProfile) {
  const setName = card?.set?.name || card?.set?.id || "Pokemon TCG";
  const setId = card?.set?.id || cardSetId(card.id);
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
        "@type": "CreativeWork",
        "@id": `${pageUrl}#card`,
        name: `${card.name} ${formatCardNumber(card) || card?.number || ""}`.trim(),
        description,
        image,
        url: pageUrl,
        identifier: card.id,
        genre: "Collectible trading card",
        isPartOf: {
          "@type": "CreativeWork",
          name: setName
        },
        creator: cleanText(card?.artist || card?.illustrator) ? {
          "@type": "Person",
          name: cleanText(card?.artist || card?.illustrator)
        } : undefined,
        about: {
          "@type": "Thing",
          name: card.name
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Route 25",
            item: "https://route25.app/"
          },
          setId ? {
            "@type": "ListItem",
            position: 2,
            name: setName,
            item: `https://route25.app/sets/${encodeURIComponent(setId)}`
          } : null,
          {
            "@type": "ListItem",
            position: 3,
            name: card.name,
            item: pageUrl
          }
        ].filter(Boolean)
      },
      {
        "@type": "SoftwareApplication",
        name: "Route 25",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "iOS",
        url: "https://route25.app/",
        downloadUrl: APP_STORE_URL
      },
      seoProfile?.faqs?.length ? {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: seoProfile.faqs.map(([name, text]) => ({
          "@type": "Question",
          name,
          acceptedAnswer: { "@type": "Answer", text }
        }))
      } : null
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
    ["Rarity", cleanText(card?.rarity)],
    ["Type", listText(card?.types)],
    ["Artist", cleanText(card?.artist || card?.illustrator)],
    ["Regulation", cleanText(card?.regulationMark)],
    ["Estimated Value", tcgcsvValue || (showAsyncPrice ? "Loading..." : null)],
    ["TCGPlayer", "Shop on TCGPlayer", options.tcgplayerUrl, true],
    ["eBay", "Search eBay listings", options.ebayUrl, true]
  ].filter(([, value]) => value);

  return rows.map(([label, value, linkUrl, isExternal]) => `
    <div class="detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${label === "Variant"
        ? `<span id="selected-variant-label">${escapeHtml(value)}</span>`
        : label === "Estimated Value"
          ? `<span id="selected-variant-price">${escapeHtml(value)}</span>`
        : linkUrl
        ? `<a class="detail-link" href="${escapeHtml(linkUrl)}" target="_blank" rel="nofollow sponsored noopener noreferrer"${label === "TCGPlayer" ? " data-tcgplayer-affiliate-link" : ""}>${escapeHtml(value)}${isExternal ? '<span class="external-link-icon" aria-hidden="true">↗</span>' : ""}<span class="sr-only"> Opens in a new tab</span></a>`
        : escapeHtml(value)}
      </dd>
    </div>
  `).join("");
}

function renderInfoRows(rows) {
  return rows.filter(([, value]) => value).map(([label, value]) => `
    <div class="reference-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join("");
}

function attackCostText(cost) {
  return Array.isArray(cost) && cost.length ? cost.join(", ") : "";
}

function renderAbilities(card) {
  const abilities = Array.isArray(card?.abilities) ? card.abilities : [];
  if (!abilities.length) return "";
  return `<article class="reference-card">
    <h3>Abilities</h3>
    ${abilities.map((ability) => `
      <div class="rules-entry">
        <strong>${escapeHtml(cleanText(ability?.name) || "Ability")}</strong>
        ${ability?.type ? `<span>${escapeHtml(ability.type)}</span>` : ""}
        ${ability?.text ? `<p>${escapeHtml(ability.text)}</p>` : ""}
      </div>
    `).join("")}
  </article>`;
}

function renderAttacks(card) {
  const attacks = Array.isArray(card?.attacks) ? card.attacks : [];
  if (!attacks.length) return "";
  return `<article class="reference-card">
    <h3>Attacks</h3>
    ${attacks.map((attack) => {
      const bits = [attackCostText(attack?.cost), attack?.damage ? `${attack.damage} damage` : ""].filter(Boolean).join(" | ");
      return `<div class="rules-entry">
        <strong>${escapeHtml(cleanText(attack?.name) || "Attack")}</strong>
        ${bits ? `<span>${escapeHtml(bits)}</span>` : ""}
        ${attack?.text ? `<p>${escapeHtml(attack.text)}</p>` : ""}
      </div>`;
    }).join("")}
  </article>`;
}

function legalityRows(card) {
  if (!card?.legalities || typeof card.legalities !== "object") return [];
  return Object.entries(card.legalities)
    .map(([format, status]) => [`${titleCaseSlug(format)} legality`, cleanText(status)])
    .filter(([, status]) => status);
}

function renderCollectorDetails(card, seoProfile) {
  const setName = cleanText(card?.set?.name || card?.set?.id);
  const collectorRows = renderInfoRows([
    ["Expansion", setName],
    ["Card number", formatCardNumber(card)],
    ["Rarity", cleanText(card?.rarity)],
    ["Illustrator", cleanText(card?.artist || card?.illustrator)],
    ["Release date", formatDate(card?.set?.releaseDate || card?.releaseDate)],
    ["Pokemon type", listText(card?.types)],
    ["Card stage", listText(card?.subtypes)],
    ["Regulation mark", cleanText(card?.regulationMark)]
  ]);
  return `<article class="reference-card collector-details">
    <h3>Collector details</h3>
    ${seoProfile?.summary ? `<p class="collector-summary">${escapeHtml(seoProfile.summary)}</p>` : ""}
    ${collectorRows ? `<dl class="reference-list">${collectorRows}</dl>` : ""}
  </article>`;
}

function renderCollectorQuestions(seoProfile) {
  const questions = Array.isArray(seoProfile?.faqs) ? seoProfile.faqs : [];
  if (!questions.length) return "";
  return `<div class="collector-questions">
    <h4>Collector questions</h4>
    ${questions.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join("")}
  </div>`;
}

function renderCardDetailsSection(card, seoProfile) {
  const gameplayRows = renderInfoRows([
    ["HP", cleanText(card?.hp)],
    ["Weakness", formatWeaknesses(card?.weaknesses)],
    ["Resistance", formatWeaknesses(card?.resistances)],
    ["Retreat cost", listText(card?.retreatCost)],
    ["Converted retreat cost", cleanText(card?.convertedRetreatCost)],
    ...legalityRows(card)
  ]);
  const collectorQuestions = renderCollectorQuestions(seoProfile);
  const cards = [
    renderAbilities(card),
    renderAttacks(card),
    gameplayRows || collectorQuestions
      ? `<article class="reference-card"><h3>Gameplay details</h3>${gameplayRows ? `<dl class="reference-list">${gameplayRows}</dl>` : ""}${collectorQuestions}</article>`
      : "",
    renderCollectorDetails(card, seoProfile)
  ].filter(Boolean).join("");

  if (!cards) return "";

  return `<section class="container reference-section" aria-labelledby="card-details-title">
    <div class="reference-heading">
      <h2 id="card-details-title">Card details</h2>
    </div>
    <div class="reference-grid">${cards}</div>
  </section>`;
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
    const productId = variant?.sourceRefs?.tcgplayerProductId || "";
    const affiliateUrl = productId ? tcgplayerAffiliateUrl(card, variant) : "";
    return `<button
      class="variant-chip${isSelected ? " active" : ""}"
      type="button"
      data-variant-id="${escapeHtml(variant.id)}"
      data-variant-label="${escapeHtml(variant.label)}"
      data-variant-price="${escapeHtml(formattedPrice)}"
      data-tcgplayer-product-id="${escapeHtml(productId)}"
      data-tcgplayer-affiliate-url="${escapeHtml(affiliateUrl)}"
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
      const tcgplayerLink = document.querySelector("[data-tcgplayer-affiliate-link]");
      const promotionUrl = ${JSON.stringify(TCGPLAYER_PROMOTION_URL)};
      const needsPricingFetch = variantPrice ? (chips.length
        ? chips.some((chip) => !chip.dataset.variantPrice)
        : (!variantPrice.textContent || variantPrice.textContent === "Loading...")) : false;
      const initialPrice = variantPrice ? (variantPrice.textContent || "") : "";
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
        if (!variantPrice) return;
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
      const affiliateUrl = (productId) => {
        if (!productId) return "";
        const destination = "https://www.tcgplayer.com/product/" + encodeURIComponent(productId);
        const url = new URL(promotionUrl);
        url.searchParams.set("u", destination);
        url.searchParams.set("subId1", "affiliate");
        return url.href;
      };
      const setTcgplayerLinkForChip = (chip) => {
        if (!tcgplayerLink) return;
        const next = chip.dataset.tcgplayerAffiliateUrl || affiliateUrl(chip.dataset.tcgplayerProductId || "");
        if (next) tcgplayerLink.href = next;
      };
      if (!chips.length || !variantLabel) {
        if (variantPrice && needsPricingFetch) {
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
          setTcgplayerLinkForChip(chip);
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
  const pageUrl = cardPageUrl(req, card.id);
  const hintedFallbacks = Array.isArray(card?.images?.fallbacks)
    ? card.images.fallbacks.map((value) => route25ImageUrl(value))
    : [];
  const lowResCandidates = resolvedCardImages(card, false).map((value) => route25ImageUrl(value)).concat(hintedFallbacks)
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  const highResCandidates = resolvedCardImages(card, true).map((value) => route25ImageUrl(value)).concat(hintedFallbacks)
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  const imageCandidates = lowResCandidates.concat(highResCandidates)
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  const image = (options.cleanUrl ? lowResCandidates[0] : highResCandidates[0]) || imageCandidates[0] || "";
  const socialImage = cardSocialImageUrl(req, card.id);
  const setLogo = route25ImageUrl(absoluteUrl(card?.set?.images?.localLogo || card?.set?.images?.logo, BACKEND_ORIGIN));
  const setName = card?.set?.name || card?.set?.id || "Pokemon TCG";
  const browseSetId = card?.set?.id || cardSetId(card.id);
  const browseSetUrl = browseSetId ? `/sets/${encodeURIComponent(browseSetId)}` : "/search";
  const appCardUrl = appDeepLink(`cards/${card.id}`);
  const cardNumber = card?.number ? ` #${card.number}` : "";
  const setCardNumber = formatCardNumber(card);
  const seoProfile = cardSeoProfile(card);
  const title = seoProfile?.title || `${card.name}${cardNumber} ${setName} ${pokemonText()} Card | Route 25`;
  const description = seoProfile?.description || metaDescription(card);
  const typeText = [card?.supertype, ...(Array.isArray(card?.subtypes) ? card.subtypes : [])].filter(Boolean).join(" / ");
  const flavorText = card?.flavorText ? `<blockquote>${escapeHtml(card.flavorText)}</blockquote>` : "";
  const ebayUrl = ebayAffiliateUrl(ebaySearchQuery(card), `r25-card-${card.id}`);
  const selected = selectedVariant(card, req);
  const tcgplayerUrl = tcgplayerAffiliateUrl(card, selected);
  const detailsSection = renderCardDetailsSection(card, seoProfile);

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
  <meta property="og:image" content="${escapeHtml(socialImage)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(socialImage)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(socialImage)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(`${card.name} ${setName} card preview on Route 25`)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/site.css" />
  <script type="application/ld+json">${jsonScript(cardStructuredData(card, pageUrl, image, description, seoProfile))}</script>
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
    .reference-section {
      padding: clamp(28px, 5vw, 54px) 0 0;
    }
    .reference-heading {
      max-width: 760px;
      margin-bottom: 20px;
    }
    .reference-heading h2 {
      font-size: clamp(30px, 4vw, 52px);
      line-height: 1;
      margin: 0 0 10px;
    }
    .reference-card p {
      color: rgba(255, 255, 255, 0.72);
      line-height: 1.58;
      margin: 0;
    }
    .reference-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .reference-card {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      padding: 18px;
    }
    .reference-card h3 {
      font-size: 18px;
      line-height: 1.15;
      margin: 0 0 14px;
    }
    .reference-list {
      display: grid;
      gap: 10px;
      margin: 0;
    }
    .reference-row {
      display: grid;
      grid-template-columns: minmax(110px, 0.7fr) minmax(0, 1fr);
      gap: 12px;
      align-items: baseline;
    }
    .reference-row dt {
      color: rgba(255, 255, 255, 0.54);
      font-size: 11px;
      font-weight: 780;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .reference-row dd {
      margin: 0;
      font-weight: 720;
    }
    .rules-entry + .rules-entry {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .rules-entry strong,
    .rules-entry span {
      display: block;
    }
    .rules-entry span {
      margin-top: 4px;
      color: rgba(255, 255, 255, 0.56);
      font-size: 13px;
      font-weight: 720;
    }
    .rules-entry p {
      margin-top: 8px;
    }
    .collector-summary {
      margin-bottom: 16px !important;
    }
    .collector-questions {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .collector-questions h4 {
      margin: 0 0 8px;
      font-size: 14px;
    }
    .collector-questions details {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 10px 0;
    }
    .collector-questions summary {
      cursor: pointer;
      font-weight: 720;
      line-height: 1.35;
    }
    .collector-questions details p {
      margin: 8px 0 0;
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
      .reference-grid {
        grid-template-columns: 1fr;
      }
      .reference-row {
        grid-template-columns: 1fr;
        gap: 3px;
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
  <main class="card-share-hero">
    <div class="container card-share-grid">
      <div class="card-art-stage">
        ${image ? `<img class="card-art" src="${escapeHtml(image)}" alt="${escapeHtml(`${card.name}${setCardNumber ? ` ${setCardNumber}` : ""} ${card?.rarity || "Pokemon"} card from ${setName}`)}" fetchpriority="high" decoding="async"${imageFallbackAttribute(imageCandidates)}${options.cleanUrl ? imageUpgradeAttribute(highResCandidates, image) : ""} />` : ""}
      </div>
      <section class="card-copy">
        <div class="card-kicker">
          ${setLogo ? `<img class="set-logo" src="${escapeHtml(setLogo)}" alt="" />` : ""}
          <span>${escapeHtml(card?.set?.name || card?.set?.id || "Pokemon TCG")}</span>
        </div>
        <h1>${escapeHtml(card.name)}</h1>
        <p class="card-meta-line">${escapeHtml([typeText, card?.rarity, setCardNumber ? `Card ${setCardNumber}` : null].filter(Boolean).join(" | "))}</p>
        ${variantChips(card, selected, options.tcgcsvQuote)}
        <dl class="detail-list">${detailRows(card, { tcgcsvQuote: options.tcgcsvQuote, ebayUrl, tcgplayerUrl, selectedVariant: selected, enableAsyncPricing: true })}</dl>
        ${flavorText}
        <div class="card-actions">
          <a class="button primary" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">Get Route 25</a>
          <a class="button" href="${escapeHtml(browseSetUrl)}">Browse this set</a>
          <a class="button" href="${escapeHtml(appCardUrl)}">Open this in Route 25</a>
        </div>
      </section>
    </div>
    ${detailsSection}
    <section class="container community-cta" aria-labelledby="community-cta-title">
      <h2 id="community-cta-title">Join a better ${pokemonText()} TCG community.</h2>
      <p>Track your collection, share pulls, talk trades, and connect with collectors who care about the cards as much as you do.</p>
      <div class="card-actions">
        <a class="button primary" href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer">Download Route 25</a>
        <a class="button" href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer">Join the Discord</a>
      </div>
    </section>
  </main>
  <script>
    function route25CardImageFallback(img) {
      const fallbacks = String(img.dataset.fallbacks || "").split("|").filter(Boolean);
      const next = fallbacks.shift();
      if (!next) {
        img.removeAttribute("onerror");
        return;
      }
      img.dataset.fallbacks = fallbacks.join("|");
      img.src = next;
    }
    ${options.cleanUrl ? `window.history.replaceState({}, "", ${JSON.stringify(cleanCardPath(card.id, req.query))});` : ""}
    (function upgradeCardImage() {
      const img = document.querySelector(".card-art[data-hires-candidates]");
      if (!img) return;
      const candidates = String(img.dataset.hiresCandidates || "").split("|").filter(Boolean);
      const loadNext = function() {
        const next = candidates.shift();
        if (!next || next === img.currentSrc || next === img.src) return;
        const hiRes = new Image();
        hiRes.decoding = "async";
        hiRes.onload = function() {
          img.removeAttribute("onerror");
          img.removeAttribute("data-fallbacks");
          img.src = next;
        };
        hiRes.onerror = loadNext;
        hiRes.src = next;
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(loadNext, { timeout: 1200 });
      } else {
        window.setTimeout(loadNext, 250);
      }
    })();
  </script>
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

const cardPageHandler = async (req, res) => {
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
    const requestHasHints = hasRequestHints(req.query);
    const hintedCard = requestHasHints ? fallbackCardFromRequest(cardId, req) : null;
    let card = await fetchCard(cardId, timings);
    if (card && hintedCard && !tcgplayerProductIds(card).length && tcgplayerProductIds(hintedCard).length) {
      card = {
        ...card,
        cardVariants: hintedCard.cardVariants
      };
    }
    if (!card) {
      card = hintedCard || fallbackCardFromRequest(cardId, req);
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
    res.end(renderCardPage(card, req, { cleanUrl: requestHasHints && !usedFallback }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(renderNotFound(cardId));
  }
};

module.exports = cardPageHandler;
module.exports.fetchCardForSocial = fetchCard;
module.exports.formatCardNumberForSocial = formatCardNumber;
module.exports.metaDescriptionForSocial = metaDescription;
module.exports.absoluteUrlForSocial = absoluteUrl;
module.exports.cardImageForSocial = resolvedCardImage;
module.exports.BACKEND_ORIGIN = BACKEND_ORIGIN;
