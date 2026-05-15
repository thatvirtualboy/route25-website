const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const responseCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

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

function searchTerms(value) {
  const terms = String(value || "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
  return terms.length ? terms : [String(value || "").trim()].filter(Boolean);
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

function simplifyCard(card) {
  return {
    id: card?.id || "",
    name: card?.name || "",
    number: card?.number || "",
    rarity: card?.rarity || "",
    types: Array.isArray(card?.types) ? card.types : [],
    images: card?.images || {},
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

function sortSets(sets) {
  return [...sets].sort((a, b) => {
    const dateA = Date.parse(a?.releaseDate || "") || 0;
    const dateB = Date.parse(b?.releaseDate || "") || 0;
    if (dateA !== dateB) return dateB - dateA;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

async function fetchSets() {
  const payload = await fetchJson(`${BACKEND_ORIGIN}/api/tcg/sets`);
  const sets = Array.isArray(payload?.data) ? payload.data : [];
  return sortSets(sets).map((set) => ({
    id: set?.id || "",
    name: set?.name || set?.id || "",
    releaseDate: set?.releaseDate || "",
    images: set?.images || {}
  })).filter((set) => set.id);
}

function buildSearchQuery({ q, set }) {
  const parts = [];
  const setId = escapePokemonQueryValue(set);
  const term = escapePokemonQueryValue(q);

  if (setId) parts.push(`set.id:${setId}`);
  if (term) {
    const normalized = normalizeCardId(term);
    parts.push(isCardIdSearch(normalized) ? `id:${normalized}` : `name:*${term}*`);
  }

  return parts.join(" ");
}

function buildSearchQueries({ q, set }) {
  const terms = searchTerms(q);
  if (!terms.length) return [buildSearchQuery({ q: "", set })].filter(Boolean);
  return terms.map((term) => buildSearchQuery({ q: term, set })).filter(Boolean);
}

async function fetchCardsBySet(set, page, pageSize) {
  const url = new URL(`${BACKEND_ORIGIN}/api/tcg/by-set`);
  url.searchParams.set("set", set);
  url.searchParams.set("pageSize", "500");

  const payload = await fetchJson(url.href);
  const allItems = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  const start = (page - 1) * pageSize;
  return {
    rawItems: allItems.slice(start, start + pageSize),
    payload: {
      page,
      pageSize,
      count: Math.min(pageSize, Math.max(0, allItems.length - start)),
      totalCount: payload?.totalCount ?? payload?.count ?? allItems.length
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
    const bySetResult = await fetchCardsBySet(browseSetId, page, pageSize);
    payload = bySetResult.payload;
    rawItems = bySetResult.rawItems;
  } else if (queries.length === 1) {
    const url = new URL(`${BACKEND_ORIGIN}/api/tcg/cards`);
    url.searchParams.set("q", queries[0]);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));

    payload = await fetchJson(url.href);
    rawItems = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : [];
  } else {
    const merged = new Map();
    const fetchSize = Math.min(page * pageSize, 250);
    const payloads = await Promise.all(queries.map(async (query) => {
      const url = new URL(`${BACKEND_ORIGIN}/api/tcg/cards`);
      url.searchParams.set("q", query);
      url.searchParams.set("page", "1");
      url.searchParams.set("pageSize", String(fetchSize));
      return fetchJson(url.href);
    }));

    for (const itemPayload of payloads) {
      const items = Array.isArray(itemPayload?.data)
        ? itemPayload.data
        : Array.isArray(itemPayload?.items)
          ? itemPayload.items
          : [];
      for (const item of items) {
        if (item?.id && !merged.has(item.id)) merged.set(item.id, item);
      }
    }
    const allItems = [...merged.values()];
    rawItems = allItems.slice((page - 1) * pageSize, page * pageSize);
    payload = {
      page,
      pageSize,
      count: rawItems.length,
      totalCount: allItems.length
    };
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
  setCachedJson(cacheKey, body);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "s-maxage=300, stale-while-revalidate=1800");
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
