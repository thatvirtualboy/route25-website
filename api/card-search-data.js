const OFFICIAL_API_ORIGIN = "https://api.pokemontcg.io/v2";
const TCGDEX_API_ORIGIN = "https://api.tcgdex.net/v2/en";
const { BACKEND_ORIGIN, route25BackendHeaders } = require("../lib/route25-backend");
const { route25ImageUrl } = require("../lib/route25-image-url");
const { canonicalCardId, canonicalCardSetId, tcgdexCardId } = require("../lib/card-set-id");
const { isPokemonTcgPocket, isPokemonTcgPocketCardId, isPokemonTcgPocketSetId } = require("../lib/card-product");
const responseCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const EMPTY_SEARCH_CACHE_TTL_MS = 30 * 1000;
const SET_CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
let setCatalogCache = null;
let setCatalogPromise = null;
let tcgdexSetAliasesCache = null;
let tcgdexSetAliasesPromise = null;
const KNOWN_SET_TOTALS = {
  me3: 124
};
const SUPPLEMENTAL_SEARCH_SET_IDS = ["mep"];
const supplementalSetCache = new Map();

function getCachedJson(key) {
  const entry = responseCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedJson(key, value, ttlMs = CACHE_TTL_MS) {
  if (responseCache.size > 80) responseCache.delete(responseCache.keys().next().value);
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
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

function splitNameAndCollectorNumber(value) {
  const match = String(value || "").trim().match(/^(.+?)\s+#?([a-z]*\d+[a-z]*)$/i);
  if (!match) return { name: String(value || "").trim(), number: "" };
  return { name: match[1].trim(), number: match[2] };
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

function cardSetId(card) {
  const explicitSetId = String(card?.set?.id || "").trim();
  if (explicitSetId) return explicitSetId.toLowerCase();
  const cardId = String(card?.id || "").trim();
  const separator = cardId.lastIndexOf("-");
  return separator > 0 ? cardId.slice(0, separator).toLowerCase() : "";
}

function sortCardsNewestFirst(cards, releaseDates, setAliases = null) {
  if (!(releaseDates instanceof Map) || !releaseDates.size) return cards;
  return cards.map((card, index) => ({
    card,
    index,
    releaseTime: Date.parse(card?.set?.releaseDate || releaseDates.get(setAliases?.get(cardSetId(card)) || cardSetId(card)) || "") || 0
  })).sort((a, b) => {
    if (a.releaseTime !== b.releaseTime) return b.releaseTime - a.releaseTime;
    const setOrder = cardSetId(a.card).localeCompare(cardSetId(b.card), undefined, { numeric: true });
    if (setOrder) return setOrder;
    const numberOrder = String(a.card?.number || "").localeCompare(String(b.card?.number || ""), undefined, { numeric: true });
    return numberOrder || a.index - b.index;
  }).map((entry) => entry.card);
}

function cardMatchesSearchTerm(card, term) {
  const normalizedTerm = normalizeCardId(term).toLowerCase();
  if (!normalizedTerm) return true;

  const nameAndNumber = splitNameAndCollectorNumber(term);
  if (nameAndNumber.number) {
    const name = textTokens(card?.name).join(" ");
    const nameTokens = textTokens(nameAndNumber.name);
    return collectorNumberMatches(card, nameAndNumber.number)
      && nameTokens.every((token) => name.includes(token));
  }

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
  if (images.small || images.large) {
    return {
      ...images,
      ...(images.small ? { small: route25ImageUrl(images.small) } : {}),
      ...(images.large ? { large: route25ImageUrl(images.large) } : {})
    };
  }

  if (String(card?.set?.id || "").toLowerCase() === "mep" || String(card?.id || "").toLowerCase().startsWith("mep-")) {
    const small = mepImageUrl(card, false);
    const large = mepImageUrl(card, true) || small;
    if (small || large) return { small, large };
  }

  const small = mepImageUrl(card, false);
  const large = mepImageUrl(card, true) || small;
  return small || large ? { small, large } : images;
}

function simplifySearchCard(card) {
  const result = {
    id: canonicalCardId(card?.id),
    name: card?.name || "",
    images: cardImages(card)
  };
  if (card?.number) result.number = card.number;
  if (card?.rarity) result.rarity = card.rarity;
  if (Array.isArray(card?.types) && card.types.length) result.types = card.types;
  if (card?.artist || card?.illustrator) result.artist = card.artist || card.illustrator;
  if (card?.regulationMark) result.regulationMark = card.regulationMark;
  if (card?.set?.id || card?.set?.name) {
    result.set = {
      id: canonicalCardSetId(card?.set?.id || cardSetId(card)),
      name: card?.set?.name || card?.set?.id || cardSetId(card)
    };
  }
  return result;
}

async function fetchJson(url) {
  const requestUrl = String(url).replace(/\*/g, "%2A");
  const response = await fetch(requestUrl, {
    headers: route25BackendHeaders(requestUrl, { accept: "application/json" })
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${requestUrl}`);
  }
  return response.json();
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const requestUrl = String(url).replace(/\*/g, "%2A");
  const controller = new AbortController();
  let timeout = null;
  try {
    return await Promise.race([
      fetch(requestUrl, {
        headers: route25BackendHeaders(requestUrl, { accept: "application/json" }),
        signal: controller.signal
      }).then((response) => {
        if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${requestUrl}`);
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
  const sets = await fetchSetCatalog(3500);
  return sortSets(sets).filter((set) => !isPokemonTcgPocket(set)).map((set) => ({
    id: set?.id || "",
    name: set?.name || set?.id || "",
    releaseDate: set?.releaseDate || "",
    images: set?.images || {},
    printedTotal: set?.printedTotal || set?.cardCount?.official || null,
    total: set?.total || set?.cardCount?.total || null
  })).filter((set) => set.id);
}

async function fetchSetCatalog(timeoutMs = 1200) {
  if (setCatalogCache?.expiresAt > Date.now()) return setCatalogCache.sets;
  if (!setCatalogPromise) {
    setCatalogPromise = fetchJsonWithTimeout(`${BACKEND_ORIGIN}/api/tcg/sets`, timeoutMs)
      .then((payload) => {
        const sets = (Array.isArray(payload?.data) ? payload.data : []).filter((set) => !isPokemonTcgPocket(set));
        setCatalogCache = { sets, expiresAt: Date.now() + SET_CATALOG_TTL_MS };
        return sets;
      })
      .finally(() => {
        setCatalogPromise = null;
      });
  }
  return setCatalogPromise;
}

async function fetchSetReleaseDates(timeoutMs = 1200) {
  const sets = await fetchSetCatalog(timeoutMs);
  return new Map(sets.map((set) => [String(set?.id || "").toLowerCase(), set?.releaseDate || ""]));
}

function normalizedSetName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim();
}

async function fetchTcgdexSetAliases(timeoutMs = 1200) {
  if (tcgdexSetAliasesCache?.expiresAt > Date.now()) return tcgdexSetAliasesCache.aliases;
  if (!tcgdexSetAliasesPromise) {
    const url = new URL(`${TCGDEX_API_ORIGIN}/sets`);
    url.searchParams.set("pagination:page", "1");
    url.searchParams.set("pagination:itemsPerPage", "500");
    tcgdexSetAliasesPromise = Promise.all([
      fetchJsonWithTimeout(url.href, timeoutMs),
      fetchSetCatalog(timeoutMs)
    ]).then(([tcgdexSets, backendSets]) => {
      const backendByName = new Map(backendSets.map((set) => [normalizedSetName(set?.name), String(set?.id || "").toLowerCase()]));
      const aliases = new Map();
      for (const set of Array.isArray(tcgdexSets) ? tcgdexSets : []) {
        if (isPokemonTcgPocket(set)) continue;
        const providerId = canonicalCardId(`${set?.id || ""}-1`).replace(/-1$/, "").toLowerCase();
        const backendId = backendByName.get(normalizedSetName(set?.name));
        if (providerId && backendId) aliases.set(providerId, backendId);
      }
      tcgdexSetAliasesCache = { aliases, expiresAt: Date.now() + SET_CATALOG_TTL_MS };
      return aliases;
    }).finally(() => {
      tcgdexSetAliasesPromise = null;
    });
  }
  return tcgdexSetAliasesPromise;
}

function normalizedCollectorNumber(value) {
  const text = String(value || "").toLowerCase().replace(/\s+/g, "");
  const match = text.match(/^([a-z]*)(\d+)([a-z]*)$/i);
  return match ? `${match[1]}${Number(match[2])}${match[3]}` : text.replace(/^0+/, "");
}

function searchCardIdentity(card, setAliases) {
  const setId = canonicalCardSetId(cardSetId(card));
  const canonicalSetId = setAliases?.get(setId) || setId;
  const idNumber = String(card?.id || "").split("-").pop();
  return [canonicalSetId, normalizedCollectorNumber(card?.number || idNumber), normalizeLookupName(card?.name)].join(":");
}

function normalizeLookupName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function mergeSearchResults(results, page, pageSize, releaseDates, setAliases) {
  const merged = new Map();
  for (const result of results.filter(Boolean)) {
    for (const card of Array.isArray(result?.allItems) ? result.allItems : (result?.rawItems || [])) {
      if (isPokemonTcgPocket(card)) continue;
      const images = cardImages(card);
      if (!card?.id || !card?.name || (!images.small && !images.large)) continue;
      const key = searchCardIdentity(card, setAliases);
      if (!merged.has(key)) merged.set(key, { ...card, images });
    }
  }
  const allItems = sortCardsNewestFirst([...merged.values()], releaseDates, setAliases);
  const rawItems = allItems.slice((page - 1) * pageSize, page * pageSize);
  return {
    allItems,
    rawItems,
    payload: { page, pageSize, count: rawItems.length, totalCount: allItems.length }
  };
}

async function settleWithin(promise, timeoutMs) {
  let timeout = null;
  try {
    return await Promise.race([
      promise.catch(() => null),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
        if (typeof timeout.unref === "function") timeout.unref();
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchSupplementalSetCards(setId, timeoutMs = 1200) {
  const key = String(setId || "").toLowerCase();
  const cached = supplementalSetCache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.cards;
  if (cached?.promise) return cached.promise;

  const url = new URL(`${BACKEND_ORIGIN}/api/tcg/by-set`);
  url.searchParams.set("set", key);
  url.searchParams.set("pageSize", "500");
  const promise = fetchJsonWithTimeout(url.href, timeoutMs).then((payload) => {
    const cards = payloadItems(payload).filter((card) => !isPokemonTcgPocket(card));
    supplementalSetCache.set(key, { cards, expiresAt: Date.now() + SET_CATALOG_TTL_MS });
    return cards;
  }).catch((error) => {
    supplementalSetCache.delete(key);
    throw error;
  });
  supplementalSetCache.set(key, { promise, expiresAt: 0 });
  return promise;
}

function cardMatchesProviderQuery(card, query) {
  const filter = tcgdexFilter(query);
  if (!filter.value) return false;
  if (filter.field === "id") {
    return canonicalCardId(card?.id).toLowerCase() === canonicalCardId(filter.value).toLowerCase();
  }
  const name = textTokens(card?.name).join(" ");
  const nameMatches = filter.tokens.length
    ? filter.tokens.every((token) => name.includes(token))
    : name.includes(String(filter.value).toLowerCase());
  return nameMatches && collectorNumberMatches(card, filter.number);
}

async function fetchSupplementalSearchResults(queries, page, pageSize, timeoutMs = 1200) {
  const catalogs = await Promise.all(SUPPLEMENTAL_SEARCH_SET_IDS.map((setId) => fetchSupplementalSetCards(setId, timeoutMs)));
  const merged = new Map();
  for (const card of catalogs.flat()) {
    if (queries.some((query) => cardMatchesProviderQuery(card, query)) && card?.id) merged.set(card.id, card);
  }
  const allItems = [...merged.values()];
  const rawItems = allItems.slice((page - 1) * pageSize, page * pageSize);
  return {
    allItems,
    rawItems,
    payload: { page, pageSize, count: rawItems.length, totalCount: allItems.length }
  };
}

function buildSearchQuery({ q, set }) {
  const parts = [];
  const setId = escapePokemonQueryValue(set);
  const term = escapePokemonQueryValue(q);

  if (setId) parts.push(`set.id:${setId}`);
  if (term) {
    const normalized = canonicalCardId(normalizeCardId(term));
    if (isCardIdSearch(normalized)) {
      parts.push(`id:${normalized}`);
    } else {
      const nameAndNumber = splitNameAndCollectorNumber(term);
      parts.push(nameSearchQuery(nameAndNumber.name));
      if (nameAndNumber.number) parts.push(`number:${nameAndNumber.number}`);
    }
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

function exactCardIdFromQuery(query) {
  const match = String(query || "").match(/(?:^|\s)id:([^\s]+)/i);
  return match ? canonicalCardId(normalizeCardId(match[1])).toLowerCase() : "";
}

function filterExactCardId(items, query) {
  const exactId = exactCardIdFromQuery(query);
  if (!exactId) return items;
  return items.filter((card) => canonicalCardId(card?.id).toLowerCase() === exactId);
}

function collectorNumberFromQuery(query) {
  const match = String(query || "").match(/(?:^|\s)number:([^\s]+)/i);
  return match ? match[1] : "";
}

function collectorNumberMatches(card, number) {
  if (!number) return true;
  const idNumber = String(card?.id || "").split("-").pop();
  return normalizedCollectorNumber(card?.number || card?.localId || idNumber) === normalizedCollectorNumber(number);
}

function filterProviderCards(items, query) {
  const exactIdItems = filterExactCardId(items, query);
  const number = collectorNumberFromQuery(query);
  return number ? exactIdItems.filter((card) => collectorNumberMatches(card, number)) : exactIdItems;
}

function rejectWithoutItems(result) {
  if (Array.isArray(result?.rawItems) && result.rawItems.length) return result;
  throw new Error("No cards returned");
}

async function fetchSearchProvider(origin, queries, page, pageSize, timeoutMs, selectFields = false, releaseDatesPromise = null) {
  if (queries.length === 1) {
    const url = new URL(`${origin}/cards`);
    url.searchParams.set("q", queries[0]);
    const shouldSort = Boolean(releaseDatesPromise);
    url.searchParams.set("page", shouldSort ? "1" : String(page));
    url.searchParams.set("pageSize", shouldSort ? "250" : String(pageSize));
    if (selectFields) url.searchParams.set("select", "id,name,number,images,set");

    const [payload, releaseDates] = await Promise.all([
      fetchJsonWithTimeout(url.href, timeoutMs),
      releaseDatesPromise || Promise.resolve(null)
    ]);
    const providerItems = filterProviderCards(payloadItems(payload), queries[0]);
    const filteredItems = providerItems.filter((card) => !isPokemonTcgPocket(card));
    const allItems = sortCardsNewestFirst(filteredItems, releaseDates);
    const rawItems = shouldSort ? allItems.slice((page - 1) * pageSize, page * pageSize) : allItems;
    const removedCount = providerItems.length - filteredItems.length;
    return {
      payload: shouldSort ? {
        page,
        pageSize,
        count: rawItems.length,
        totalCount: allItems.length
      } : removedCount ? {
        ...payload,
        count: rawItems.length,
        totalCount: Math.max(rawItems.length, Number(payload?.totalCount || providerItems.length) - removedCount)
      } : payload,
      rawItems,
      allItems: shouldSort ? allItems : rawItems
    };
  }

  const merged = new Map();
  const fetchSize = Math.min(page * pageSize, 250);
  const payloads = await Promise.all(queries.map(async (query) => {
    const url = new URL(`${origin}/cards`);
    url.searchParams.set("q", query);
    url.searchParams.set("page", "1");
    url.searchParams.set("pageSize", String(fetchSize));
    if (selectFields) url.searchParams.set("select", "id,name,number,images,set");
    return { query, payload: await fetchJsonWithTimeout(url.href, timeoutMs) };
  }));

  for (const { query, payload: itemPayload } of payloads) {
    for (const item of filterProviderCards(payloadItems(itemPayload), query).filter((card) => !isPokemonTcgPocket(card))) {
      if (item?.id && !merged.has(item.id)) merged.set(item.id, item);
    }
  }
  const releaseDates = releaseDatesPromise ? await releaseDatesPromise : null;
  const allItems = sortCardsNewestFirst([...merged.values()], releaseDates);
  const rawItems = allItems.slice((page - 1) * pageSize, page * pageSize);
  return {
    allItems,
    rawItems,
    payload: {
      page,
      pageSize,
      count: rawItems.length,
      totalCount: allItems.length
    }
  };
}

function tcgdexFilter(query) {
  const idMatch = String(query || "").match(/^id:([^\s]+)$/i);
  if (idMatch) {
    const value = tcgdexCardId(normalizeCardId(idMatch[1]));
    return { field: "id", value, tokens: [], number: "" };
  }
  const nameParts = Array.from(String(query || "").matchAll(/name:\*([^*]+)\*/gi), (match) => match[1]);
  return {
    field: "name",
    value: nameParts[0] || "",
    tokens: nameParts.map((part) => part.toLowerCase()),
    number: collectorNumberFromQuery(query)
  };
}

function normalizeTcgdexCards(items) {
  return (Array.isArray(items) ? items : []).filter((card) => !isPokemonTcgPocket(card)).map((card) => {
    const image = String(card?.image || "").replace(/\/$/, "");
    const normalized = {
      id: canonicalCardId(card?.id),
      name: card?.name || "",
      number: card?.localId || "",
      images: image ? {
        small: `${image}/low.webp`,
        large: `${image}/high.webp`
      } : {}
    };
    if (!normalized.images.small && normalized.id.toLowerCase().startsWith("mep-")) {
      normalized.images = {
        small: mepImageUrl(normalized, false),
        large: mepImageUrl(normalized, true)
      };
    }
    return normalized;
  }).filter((card) => card.id && card.images.small);
}

function filterTcgdexCards(items, filter) {
  const cards = normalizeTcgdexCards(items);
  if (filter.field === "id") {
    const exactId = canonicalCardId(filter.value).toLowerCase();
    return cards.filter((card) => canonicalCardId(card.id).toLowerCase() === exactId);
  }
  if (filter.field !== "name" || (filter.tokens.length < 2 && !filter.number)) return cards;
  return cards.filter((card) => {
    const name = textTokens(card.name).join(" ");
    return collectorNumberMatches(card, filter.number)
      && filter.tokens.every((token) => name.includes(token));
  });
}

async function fetchTcgdexSearchResults(queries, page, pageSize, timeoutMs = 3500, releaseDatesPromise = null) {
  if (queries.length === 1) {
    const filter = tcgdexFilter(queries[0]);
    if (!filter.value) throw new Error("Unsupported TCGdex search query");
    const url = new URL(`${TCGDEX_API_ORIGIN}/cards`);
    url.searchParams.set(filter.field, filter.value);
    const [items, releaseDates] = await Promise.all([
      fetchJsonWithTimeout(url.href, timeoutMs),
      releaseDatesPromise || Promise.resolve(null)
    ]);
    const allItems = sortCardsNewestFirst(filterTcgdexCards(items, filter), releaseDates);
    const start = (page - 1) * pageSize;
    const rawItems = allItems.slice(start, start + pageSize);
    return {
      allItems,
      rawItems,
      payload: {
        page,
        pageSize,
        count: rawItems.length,
        totalCount: allItems.length
      }
    };
  }

  const merged = new Map();
  const fetchSize = Math.min(page * pageSize, 250);
  const payloads = await Promise.all(queries.map(async (query) => {
    const filter = tcgdexFilter(query);
    if (!filter.value) return [];
    const url = new URL(`${TCGDEX_API_ORIGIN}/cards`);
    url.searchParams.set(filter.field, filter.value);
    url.searchParams.set("pagination:page", "1");
    url.searchParams.set("pagination:itemsPerPage", String(fetchSize));
    return {
      filter,
      payload: await fetchJsonWithTimeout(url.href, timeoutMs)
    };
  }));
  for (const { filter, payload } of payloads) {
    for (const card of filterTcgdexCards(payload, filter)) {
      if (!merged.has(card.id)) merged.set(card.id, card);
    }
  }
  const releaseDates = releaseDatesPromise ? await releaseDatesPromise : null;
  const allItems = sortCardsNewestFirst([...merged.values()], releaseDates);
  const rawItems = allItems.slice((page - 1) * pageSize, page * pageSize);
  return {
    allItems,
    rawItems,
    payload: {
      page,
      pageSize,
      count: rawItems.length,
      totalCount: allItems.length
    }
  };
}

async function fetchRemoteSearchResults(queries, page, pageSize, timeoutMs = 2200) {
  const shouldSortNewest = queries.some((query) => /(?:^|\s)name:/i.test(query));
  const needsSupplementalCatalog = shouldSortNewest || queries.some((query) => /(?:^|\s)id:mep-/i.test(query));
  const backendTimeoutMs = shouldSortNewest ? Math.min(timeoutMs, 1200) : timeoutMs;
  const releaseDatesPromise = shouldSortNewest
    ? fetchSetReleaseDates(Math.min(timeoutMs, 1200)).catch(() => new Map())
    : null;
  const setAliasesPromise = shouldSortNewest
    ? fetchTcgdexSetAliases(Math.min(timeoutMs, 1200)).catch(() => new Map())
    : null;
  const fallbackProviders = [
    fetchSearchProvider(`${BACKEND_ORIGIN}/api/tcg`, queries, page, pageSize, backendTimeoutMs, false, releaseDatesPromise),
    fetchSearchProvider(OFFICIAL_API_ORIGIN, queries, page, pageSize, Math.min(timeoutMs, 5000), true, releaseDatesPromise)
  ];
  fallbackProviders.forEach((provider) => provider.catch(() => {}));
  const supplementalProvider = needsSupplementalCatalog
    ? fetchSupplementalSearchResults(queries, page, pageSize, Math.min(timeoutMs, 1200))
    : Promise.resolve({
        allItems: [],
        rawItems: [],
        payload: { page, pageSize, count: 0, totalCount: 0 }
      });
  supplementalProvider.catch(() => {});
  const preferredProvider = fetchTcgdexSearchResults(queries, page, pageSize, Math.min(timeoutMs, 1200), releaseDatesPromise);
  preferredProvider.catch(() => {});

  // The Route 25 backend is the app's complete card catalog. For name searches,
  // wait for it before accepting a faster third-party response; otherwise a new
  // release can appear in the app and on set pages while still being absent from
  // web search until the external providers catch up.
  if (shouldSortNewest) {
    const backendResult = await fallbackProviders[0].then(rejectWithoutItems).catch(() => null);
    if (backendResult) {
      const [preferredResult, officialResult, supplementalResult, releaseDates, setAliases] = await Promise.all([
        settleWithin(preferredProvider, Math.min(timeoutMs, 1200)),
        settleWithin(fallbackProviders[1], 450),
        settleWithin(supplementalProvider, 450),
        releaseDatesPromise,
        setAliasesPromise
      ]);
      return mergeSearchResults(
        [backendResult, preferredResult, officialResult, supplementalResult],
        page,
        pageSize,
        releaseDates,
        setAliases
      );
    }
  }

  try {
    const preferredResult = rejectWithoutItems(await preferredProvider);
    if (!shouldSortNewest) return preferredResult;
    const [backendResult, supplementalResult, releaseDates, setAliases] = await Promise.all([
      settleWithin(fallbackProviders[0], 450),
      settleWithin(supplementalProvider, 450),
      releaseDatesPromise,
      setAliasesPromise
    ]);
    return mergeSearchResults([preferredResult, backendResult, supplementalResult], page, pageSize, releaseDates, setAliases);
  } catch {
    // Both fallback requests were started in parallel, so a slow preferred
    // provider does not add another full network round-trip.
  }

  try {
    const fallbackResult = await Promise.any([...fallbackProviders, supplementalProvider].map((provider) => provider.then(rejectWithoutItems)));
    if (!shouldSortNewest) return fallbackResult;
    const [supplementalResult, releaseDates, setAliases] = await Promise.all([
      settleWithin(supplementalProvider, 450),
      releaseDatesPromise,
      setAliasesPromise
    ]);
    return mergeSearchResults([fallbackResult, supplementalResult], page, pageSize, releaseDates, setAliases);
  } catch (error) {
    const settled = await Promise.allSettled([preferredProvider, ...fallbackProviders, supplementalProvider]);
    const emptyResult = settled.find((result) => result.status === "fulfilled");
    if (emptyResult) return emptyResult.value;
    throw error;
  }
}

async function fetchJapaneseSearchResults(q, page, pageSize, timeoutMs = 6500) {
  const start = (page - 1) * pageSize;
  const end = page * pageSize;
  const collected = [];
  let cursor = null;
  let totalCount = null;

  do {
    const url = new URL(`${BACKEND_ORIGIN}/api/tcg/search`);
    url.searchParams.set("region", "jp");
    url.searchParams.set("q", q);
    url.searchParams.set("pageSize", String(Math.min(150, Math.max(8, end - collected.length))));
    url.searchParams.set("sort", "newest");
    // The stable preview predates the public totalCount field. Keep the
    // lightweight debug total as a compatibility fallback during rollout.
    url.searchParams.set("debug", "1");
    if (cursor) url.searchParams.set("cursor", cursor);

    const searchPayload = await fetchJsonWithTimeout(url.href, timeoutMs);
    const items = payloadItems(searchPayload);
    collected.push(...items);
    if (Number.isFinite(Number(searchPayload?.totalCount))) {
      totalCount = Number(searchPayload.totalCount);
    } else if (Number.isFinite(Number(searchPayload?.debug?.total))) {
      totalCount = Number(searchPayload.debug.total);
    }
    cursor = typeof searchPayload?.nextCursor === "string" && searchPayload.nextCursor
      ? searchPayload.nextCursor
      : null;
  } while (cursor && collected.length < end);

  const rawItems = collected.slice(start, end);
  return {
    rawItems,
    payload: {
      page,
      pageSize,
      count: rawItems.length,
      totalCount: totalCount ?? collected.length
    }
  };
}

async function fetchAllCardsForSet(set, setInfo = null) {
  const normalizedSet = String(set || "").trim();
  if (isPokemonTcgPocketSetId(normalizedSet) || isPokemonTcgPocket(setInfo)) {
    return { rawItems: [], payload: { page: 1, pageSize: 0, count: 0, totalCount: 0 } };
  }
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
  const allItems = payloadItems(payload).filter((card) => !isPokemonTcgPocket(card));

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
  const searchItems = payloadItems(searchPayload).filter((card) => !isPokemonTcgPocket(card));
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
  if (isPokemonTcgPocketSetId(normalizedSet) || isPokemonTcgPocket(setInfo)) {
    return { rawItems: [], payload: { page, pageSize, count: 0, totalCount: 0 } };
  }
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
  const region = String(req.query?.region || "").toLowerCase() === "jp" ? "jp" : "international";
  const page = parsePositiveInt(req.query?.page, 1, 1000);
  const pageSize = parsePositiveInt(req.query?.pageSize, 24, 48);

  if ((set && isPokemonTcgPocketSetId(set)) || isPokemonTcgPocketCardId(q)) {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.end(JSON.stringify({ ok: true, data: [], page, pageSize, count: 0, totalCount: 0 }));
    return;
  }

  if (!q && !set) {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ ok: true, data: [], page, pageSize, count: 0, totalCount: 0 }));
    return;
  }

  let queries = region === "jp" && q ? [] : buildSearchQueries({ q, set });
  let defaultSet = null;
  if (!queries.length && region !== "jp") {
    const sets = await fetchSets();
    defaultSet = sets[0] || null;
    queries = defaultSet?.id ? [`set.id:${defaultSet.id}`] : [];
  }

  if (!queries.length && region !== "jp") {
    const body = JSON.stringify({ ok: true, data: [], page, pageSize, count: 0, totalCount: 0 });
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(body);
    return;
  }

  const cacheKey = region === "jp"
    ? `cards:jp:${q.toLowerCase()}:page:${page}:size:${pageSize}`
    : `cards:${queries.join("|")}:page:${page}:size:${pageSize}`;
  const cached = getCachedJson(cacheKey);
  if (cached) {
    const cachedPayload = JSON.parse(cached);
    const hasResults = Array.isArray(cachedPayload?.data) && cachedPayload.data.length > 0;
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader(
      "cache-control",
      hasResults ? "s-maxage=60, stale-while-revalidate=300" : "public, s-maxage=15, stale-while-revalidate=30"
    );
    res.end(cached);
    return;
  }

  let payload = null;
  let rawItems = [];
  const browseSetId = !q ? (set || defaultSet?.id || "") : "";
  if (region === "jp") {
    const japaneseResult = await fetchJapaneseSearchResults(q, page, pageSize);
    payload = japaneseResult.payload;
    rawItems = japaneseResult.rawItems;
  } else if (browseSetId) {
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
    const remoteResult = await fetchRemoteSearchResults(queries, page, pageSize, 6500);
    payload = remoteResult.payload;
    rawItems = remoteResult.rawItems;
  } else {
    const remoteResult = await fetchRemoteSearchResults(queries, page, pageSize, 6500);
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

  rawItems = rawItems.filter((card) => !isPokemonTcgPocket(card));
  const body = JSON.stringify({
    ok: true,
    data: rawItems.map(simplifySearchCard),
    page: payload?.page || page,
    pageSize: payload?.pageSize || pageSize,
    count: payload?.count ?? rawItems.length,
    totalCount: payload?.totalCount ?? rawItems.length,
    defaultSet,
    ...(region === "jp" ? { region: "jp" } : {})
  });
  setCachedJson(cacheKey, body, rawItems.length ? SEARCH_CACHE_TTL_MS : EMPTY_SEARCH_CACHE_TTL_MS);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader(
    "cache-control",
    rawItems.length ? "s-maxage=60, stale-while-revalidate=300" : "public, s-maxage=15, stale-while-revalidate=30"
  );
  res.end(body);
}

module.exports = async (req, res) => {
  const startedAt = Date.now();
  try {
    if (req.query?.sets === "1") {
      await handleSets(res);
      return;
    }

    await handleSearch(req, res);
    const totalMs = Date.now() - startedAt;
    if (totalMs > 1500) {
      console.log(JSON.stringify({
        route: "card-search",
        query: String(req.query?.q || "").slice(0, 80),
        page: parsePositiveInt(req.query?.page, 1, 1000),
        totalMs
      }));
    }
  } catch (error) {
    console.error(JSON.stringify({
      route: "card-search",
      totalMs: Date.now() - startedAt,
      error: String(error?.message || error || "Search unavailable").slice(0, 300)
    }));
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Search unavailable" }));
  }
};
