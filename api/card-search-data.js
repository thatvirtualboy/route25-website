const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const { route25ImageUrl } = require("../lib/route25-image-url");
const responseCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const KNOWN_SET_TOTALS = {
  me3: 124
};

function getCachedJson(key) {
  const entry = responseCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedJson(key, value) {
  if (responseCache.size > 80) responseCache.delete(responseCache.keys().next().value);
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function normalizeCardId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/^sv35-/i, "sv3pt5-");
}

function escapePokemonQueryValue(value) {
  return String(value || "")
    .trim()
    .replace(/[(){}[\]"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePositiveInt(value, fallback, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function isCardIdSearch(value) {
  return /^[a-z0-9]+(?:pt[0-9]+)?-[a-z0-9]+$/i.test(String(value || "").trim());
}

function nameSearchQuery(value) {
  const tokens = Array.from(String(value || "").matchAll(/[\p{L}\p{N}]+/gu), (match) => match[0])
    .map((token) => escapePokemonQueryValue(token))
    .filter(Boolean);
  return tokens.map((token) => `name:*${token}*`).join(" ");
}

function searchTerms(value) {
  const terms = String(value || "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
  return terms.length ? terms : [String(value || "").trim()].filter(Boolean);
}

function textTokens(value) {
  return Array.from(String(value || "").matchAll(/[\p{L}\p{N}]+/gu), (match) => match[0].toLowerCase());
}

function cardMatchesSearchTerm(card, term) {
  const normalizedTerm = normalizeCardId(term).toLowerCase();
  if (!normalizedTerm) return true;

  const id = String(card?.id || "").toLowerCase();
  const number = String(card?.number || "").toLowerCase();
  if (id === normalizedTerm || number === normalizedTerm) return true;

  const haystack = [
    card?.name,
    card?.id,
    card?.number,
    card?.set?.name,
    card?.rarity,
    ...(Array.isArray(card?.types) ? card.types : [])
  ].map((value) => String(value || "").toLowerCase()).join(" ");

  const tokens = textTokens(term);
  return tokens.length ? tokens.every((token) => haystack.includes(token)) : haystack.includes(normalizedTerm);
}

async function fetchCardsBySetSearch(set, q, page, pageSize, setInfo = null) {
  const bySetResult = await fetchAllCardsForSet(set, setInfo);
  const terms = searchTerms(q);
  const filtered = bySetResult.rawItems.filter((card) => {
    return terms.some((term) => cardMatchesSearchTerm(card, term));
  });
  const start = (page - 1) * pageSize;
  return {
    rawItems: filtered.slice(start, start + pageSize),
    payload: {
      page,
      pageSize,
      count: Math.min(pageSize, Math.max(0, filtered.length - start)),
      totalCount: filtered.length
    }
  };
}

function marketPrice(card) {
  const priceGroups = card?.tcgplayer?.prices;
  if (!priceGroups || typeof priceGroups !== "object") return null;

  const values = Object.values(priceGroups)
    .flatMap((group) => [group?.market, group?.mid, group?.low])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length ? Math.max(...values) : null;
}

function tcgplayerProductId(card) {
  const variants = Array.isArray(card?.cardVariants) ? card.cardVariants : [];
  for (const variant of variants) {
    const productId = variant?.sourceRefs?.tcgplayerProductId;
    if (productId) return productId;
  }
  return null;
}

function mepImageUrl(card, large = false) {
  if (String(card?.set?.id || "").toLowerCase() !== "mep" && !String(card?.id || "").toLowerCase().startsWith("mep-")) return "";

  const productId = tcgplayerProductId(card);
  if (productId) {
    return `https://tcgplayer-cdn.tcgplayer.com/product/${productId}${large ? "_in_1000x1000" : "_200w"}.jpg`;
  }

  const id = String(card?.id || "");
  const number = String(card?.number || "").padStart(3, "0");
  const imageKey = id.toLowerCase().startsWith("mep-") ? id.slice(4) : number;
  return imageKey ? route25ImageUrl(`${BACKEND_ORIGIN}/card-images/mep/mep-${imageKey}.webp`) : "";
}

function cardImages(card) {
  const images = card?.images || {};
  if (String(card?.set?.id || "").toLowerCase() === "mep" || String(card?.id || "").toLowerCase().startsWith("mep-")) {
    const small = mepImageUrl(card, false);
    const large = mepImageUrl(card, true) || small;
    if (small || large) return { small, large };
  }

  if (images.small || images.large) {
    return {
      ...images,
      ...(images.small ? { small: route25ImageUrl(images.small) } : {}),
      ...(images.large ? { large: route25ImageUrl(images.large) } : {})
    };
  }

  const small = mepImageUrl(card, false);
  const large = mepImageUrl(card, true) || small;
  return small || large ? { small, large } : images;
}

function simplifyCard(card) {
  return {
    id: card?.id || "",
    name: card?.name || "",
    number: card?.number || "",
    rarity: card?.rarity || "",
    types: Array.isArray(card?.types) ? card.types : [],
    images: cardImages(card),
    cardVariants: Array.isArray(card?.cardVariants) ? card.cardVariants : [],
    set: {
      id: card?.set?.id || "",
      name: card?.set?.name || "",
      releaseDate: card?.set?.releaseDate || "",
      images: card?.set?.images || {}
    },
    market: marketPrice(card)
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
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
      fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      }).then((response) => {
        if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
        return response.json();
      }),
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

function sortSets(sets) {
  return [...sets].sort((a, b) => {
    const dateA = Date.parse(a?.releaseDate || "") || 0;
    const dateB = Date.parse(b?.releaseDate || "") || 0;
    if (dateA !== dateB) return dateB - dateA;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

function syntheticSetCards(set, page, pageSize) {
  const setId = String(set?.id || "").trim();
  const total = Number(set?.total || set?.printedTotal || set?.cardCount?.total || set?.cardCount?.official || KNOWN_SET_TOTALS[setId.toLowerCase()]);
  if (!setId || !Number.isFinite(total) || total < 1) return null;
  const start = (page - 1) * pageSize;
  const numbers = Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, index) => start + index + 1);
  return {
    rawItems: numbers.map((number) => ({
      id: `${setId}-${number}`,
      name: `${set?.name || setId} #${String(number).padStart(3, "0")}`,
      number: String(number),
      rarity: "",
      images: {
        small: `https://images.scrydex.com/pokemon/${setId}-${number}/small`,
        large: `https://images.scrydex.com/pokemon/${setId}-${number}/large`
      },
      set: {
        id: setId,
        name: set?.name || setId,
        releaseDate: set?.releaseDate || "",
        images: set?.images || {},
        printedTotal: set?.printedTotal,
        total: set?.total
      }
    })),
    payload: {
      page,
      pageSize,
      count: numbers.length,
      totalCount: total
    }
  };
}

async function fetchSets() {
  const payload = await fetchJson(`${BACKEND_ORIGIN}/api/tcg/sets`);
  const sets = Array.isArray(payload?.data) ? payload.data : [];
  return sortSets(sets).map((set) => ({
    id: set?.id || "",
    name: set?.name || set?.id || "",
    releaseDate: set?.releaseDate || "",
    images: set?.images || {},
    printedTotal: set?.printedTotal || set?.cardCount?.official || null,
    total: set?.total || set?.cardCount?.total || null
  })).filter((set) => set.id);
}

function buildSearchQuery({ q, set }) {
  const parts = [];
  const setId = escapePokemonQueryValue(set);
  const term = escapePokemonQueryValue(q);

  if (setId) parts.push(`set.id:${setId}`);
  if (term) {
    const normalized = normalizeCardId(term);
    const nameQuery = nameSearchQuery(term);
    parts.push(isCardIdSearch(normalized) ? `id:${normalized}` : nameQuery);
  }

  return parts.filter(Boolean).join(" ");
}

function buildSearchQueries({ q, set }) {
  const terms = searchTerms(q);
  if (!terms.length) return [buildSearchQuery({ q: "", set })].filter(Boolean);
  return terms.map((term) => buildSearchQuery({ q: term, set })).filter(Boolean);
}

function payloadItems(payload) {
  return Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
}

function rejectWithoutItems(result) {
  if (Array.isArray(result?.rawItems) && result.rawItems.length) return result;
  throw new Error("No cards returned");
}

async function fetchRemoteSearchResults(queries, page, pageSize, timeoutMs = 2200) {
  if (queries.length === 1) {
    const url = new URL(`${BACKEND_ORIGIN}/api/tcg/cards`);
    url.searchParams.set("q", queries[0]);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));

    const payload = await fetchJsonWithTimeout(url.href, timeoutMs);
    const rawItems = payloadItems(payload);
    return {
      payload,
      rawItems
    };
  }

  const merged = new Map();
  const fetchSize = Math.min(page * pageSize, 250);
  const payloads = await Promise.all(queries.map(async (query) => {
    const url = new URL(`${BACKEND_ORIGIN}/api/tcg/cards`);
    url.searchParams.set("q", query);
    url.searchParams.set("page", "1");
    url.searchParams.set("pageSize", String(fetchSize));
    return fetchJsonWithTimeout(url.href, timeoutMs);
  }));

  for (const itemPayload of payloads) {
    for (const item of payloadItems(itemPayload)) {
      if (item?.id && !merged.has(item.id)) merged.set(item.id, item);
    }
  }
  const allItems = [...merged.values()];
  const rawItems = allItems.slice((page - 1) * pageSize, page * pageSize);
  return {
    rawItems,
    payload: {
      page,
      pageSize,
      count: rawItems.length,
      totalCount: allItems.length
    }
  };
}

async function fetchAllCardsForSet(set, setInfo = null) {
  const normalizedSet = String(set || "").trim();
  const cacheKey = `set-cards:${normalizedSet.toLowerCase()}`;
  const cached = getCachedJson(cacheKey);
  if (cached) return cached;

  const url = new URL(`${BACKEND_ORIGIN}/api/tcg/by-set`);
  url.searchParams.set("set", normalizedSet);
  url.searchParams.set("pageSize", "500");

  let payload = null;
  try {
    payload = await fetchJsonWithTimeout(url.href, 6500);
  } catch {
    payload = null;
  }
  const allItems = payloadItems(payload);

  if (allItems.length) {
    const result = {
      rawItems: allItems,
      payload: {
        page: 1,
        pageSize: allItems.length,
        count: allItems.length,
        totalCount: payload?.totalCount ?? payload?.count ?? allItems.length
      }
    };
    setCachedJson(cacheKey, result);
    return result;
  }

  const searchUrl = new URL(`${BACKEND_ORIGIN}/api/tcg/cards`);
  searchUrl.searchParams.set("q", `set.id:${normalizedSet}`);
  searchUrl.searchParams.set("page", "1");
  searchUrl.searchParams.set("pageSize", "500");
  let searchPayload = null;
  try {
    searchPayload = await fetchJsonWithTimeout(searchUrl.href, 4500);
  } catch {
    searchPayload = null;
  }
  const searchItems = payloadItems(searchPayload);
  if (searchItems.length) {
    const result = {
      rawItems: searchItems,
      payload: {
        page: 1,
        pageSize: searchItems.length,
        count: searchItems.length,
        totalCount: searchPayload?.totalCount ?? searchPayload?.count ?? searchItems.length
      }
    };
    setCachedJson(cacheKey, result);
    return result;
  }

  const fallbackSet = setInfo || (await fetchSets()).find((item) => item.id.toLowerCase() === normalizedSet.toLowerCase());
  const total = Number(fallbackSet?.total || fallbackSet?.printedTotal || fallbackSet?.cardCount?.total || fallbackSet?.cardCount?.official || KNOWN_SET_TOTALS[normalizedSet.toLowerCase()]);
  const synthetic = syntheticSetCards({ ...fallbackSet, id: normalizedSet, total }, 1, Number.isFinite(total) ? total : 0);
  if (synthetic) return synthetic;

  return {
    rawItems: [],
    payload: {
      page: 1,
      pageSize: 0,
      count: 0,
      totalCount: 0
    }
  };
}

async function fetchCardsBySet(set, page, pageSize, setInfo = null) {
  const normalizedSet = String(set || "").trim();
  const fullSetCacheKey = `set-cards:${normalizedSet.toLowerCase()}`;
  const cachedFullSet = getCachedJson(fullSetCacheKey);
  if (cachedFullSet) {
    const start = (page - 1) * pageSize;
    return {
      rawItems: cachedFullSet.rawItems.slice(start, start + pageSize),
      payload: {
        page,
        pageSize,
        count: Math.min(pageSize, Math.max(0, cachedFullSet.rawItems.length - start)),
        totalCount: cachedFullSet.payload?.totalCount ?? cachedFullSet.rawItems.length
      }
    };
  }

  const searchUrl = new URL(`${BACKEND_ORIGIN}/api/tcg/cards`);
  searchUrl.searchParams.set("q", `set.id:${normalizedSet}`);
  searchUrl.searchParams.set("page", String(page));
  searchUrl.searchParams.set("pageSize", String(pageSize));

  const searchPromise = fetchJsonWithTimeout(searchUrl.href, 4500)
    .then((searchPayload) => {
      const searchItems = payloadItems(searchPayload);
      return rejectWithoutItems({
        rawItems: searchItems,
        payload: {
          page: searchPayload?.page || page,
          pageSize: searchPayload?.pageSize || pageSize,
          count: searchPayload?.count ?? searchItems.length,
          totalCount: searchPayload?.totalCount ?? searchItems.length
        }
      });
    });

  const fullSetPromise = fetchAllCardsForSet(normalizedSet, setInfo)
    .then((setResult) => {
      const start = (page - 1) * pageSize;
      return rejectWithoutItems({
        rawItems: setResult.rawItems.slice(start, start + pageSize),
        payload: {
          page,
          pageSize,
          count: Math.min(pageSize, Math.max(0, setResult.rawItems.length - start)),
          totalCount: setResult.payload?.totalCount ?? setResult.rawItems.length
        }
      });
    });

  let setResult = null;
  try {
    return await Promise.any([searchPromise, fullSetPromise]);
  } catch {
    setResult = await fetchAllCardsForSet(normalizedSet, setInfo);
  }

  const start = (page - 1) * pageSize;
  return {
    rawItems: setResult.rawItems.slice(start, start + pageSize),
    payload: {
      page,
      pageSize,
      count: Math.min(pageSize, Math.max(0, setResult.rawItems.length - start)),
      totalCount: setResult.payload?.totalCount ?? setResult.rawItems.length
    }
  };
}

async function handleSets(res) {
  const cached = getCachedJson("sets");
  if (cached) {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "s-maxage=86400, stale-while-revalidate=604800");
    res.end(cached);
    return;
  }

  const sets = await fetchSets();
  const body = JSON.stringify({ ok: true, data: sets });
  setCachedJson("sets", body);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "s-maxage=86400, stale-while-revalidate=604800");
  res.end(body);
}

async function handleSearch(req, res) {
  const q = String(req.query?.q || "").trim();
  const set = String(req.query?.set || "").trim();
  const page = parsePositiveInt(req.query?.page, 1, 1000);
  const pageSize = parsePositiveInt(req.query?.pageSize, 24, 48);

  let queries = buildSearchQueries({ q, set });
  let defaultSet = null;
  if (!queries.length) {
    const sets = await fetchSets();
    defaultSet = sets[0] || null;
    queries = defaultSet?.id ? [`set.id:${defaultSet.id}`] : [];
  }

  if (!queries.length) {
    const body = JSON.stringify({ ok: true, data: [], page, pageSize, count: 0, totalCount: 0 });
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(body);
    return;
  }

  const cacheKey = `cards:${queries.join("|")}:page:${page}:size:${pageSize}`;
  const cached = getCachedJson(cacheKey);
  if (cached) {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "s-maxage=300, stale-while-revalidate=1800");
    res.end(cached);
    return;
  }

  let payload = null;
  let rawItems = [];
  const browseSetId = !q ? (set || defaultSet?.id || "") : "";
  if (browseSetId) {
    const bySetResult = await fetchCardsBySet(browseSetId, page, pageSize, defaultSet);
    payload = bySetResult.payload;
    rawItems = bySetResult.rawItems;
  } else if (set && q) {
    const bySetSearchPromise = fetchCardsBySetSearch(set, q, page, pageSize, defaultSet).then(rejectWithoutItems);
    const remoteSearchPromise = fetchRemoteSearchResults(queries, page, pageSize, 1800).then(rejectWithoutItems);
    let searchResult = null;
    try {
      searchResult = await Promise.any([bySetSearchPromise, remoteSearchPromise]);
    } catch {
      searchResult = await fetchCardsBySetSearch(set, q, page, pageSize, defaultSet);
    }
    payload = searchResult.payload;
    rawItems = searchResult.rawItems;
  } else if (queries.length === 1) {
    const remoteResult = await fetchRemoteSearchResults(queries, page, pageSize, 2600);
    payload = remoteResult.payload;
    rawItems = remoteResult.rawItems;
  } else {
    const remoteResult = await fetchRemoteSearchResults(queries, page, pageSize, 2600);
    payload = remoteResult.payload;
    rawItems = remoteResult.rawItems;
  }

  if (browseSetId && !rawItems.length) {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: false, error: "Set temporarily unavailable" }));
    return;
  }

  const body = JSON.stringify({
    ok: true,
    data: rawItems.map(simplifyCard),
    page: payload?.page || page,
    pageSize: payload?.pageSize || pageSize,
    count: payload?.count ?? rawItems.length,
    totalCount: payload?.totalCount ?? rawItems.length,
    defaultSet
  });
  if (rawItems.length) setCachedJson(cacheKey, body);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader(
    "cache-control",
    rawItems.length ? "s-maxage=300, stale-while-revalidate=1800" : "no-store"
  );
  res.end(body);
}

module.exports = async (req, res) => {
  try {
    if (req.query?.sets === "1") {
      await handleSets(res);
      return;
    }

    await handleSearch(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Search unavailable" }));
  }
};
