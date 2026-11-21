const { loadSetCatalogs } = require("../lib/set-catalogs");
const { readChineseCatalog } = require("../lib/chinese-catalog");
const SITE_ORIGIN = "https://route25.app";
const { canonicalCardId, canonicalCardSetId } = require("../lib/card-set-id");
const { catalogRegion, route25BackendUrl, route25BackendHeaders } = require("../lib/route25-backend");

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: route25BackendHeaders(url, { accept: "application/json" }) });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return response.json();
}

async function fetchCards(setId) {
  const params = { set: setId, pageSize: 500 };
  const payload = catalogRegion(setId) === "cn" ? await readChineseCatalog("by-set", params)
    : await fetchJson(route25BackendUrl("/api/tcg/by-set", setId, params));
  return Array.isArray(payload.items) ? payload.items : [];
}

function renderSitemapIndex(sets) {
  const body = sets
    .filter((set) => set?.id)
    .map((set) => {
      const loc = `${SITE_ORIGIN}/sitemap-cards.xml?set=${encodeURIComponent(canonicalCardSetId(set.id))}`;
      return `  <sitemap><loc>${escapeXml(loc)}</loc></sitemap>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

function renderCardUrlset(cards) {
  const cardIds = [...new Set(cards
    .map((card) => canonicalCardId(card?.id))
    .filter(Boolean))];
  const body = cardIds
    .map((cardId) => {
      const loc = `${SITE_ORIGIN}/cards/${encodeURIComponent(cardId)}`;
      return `  <url><loc>${escapeXml(loc)}</loc></url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

module.exports = async (req, res) => {
  try {
    const setId = String(req.query?.set || "").trim();
    const catalogs = await loadSetCatalogs();
    const sets = catalogs.flatMap(group => group.sets);
    if (!sets.length || catalogs.some(group => group.unavailable && group.region === catalogRegion(setId) && setId)) throw new Error("Catalog unavailable");

    res.statusCode = 200;
    res.setHeader("content-type", "application/xml; charset=utf-8");
    res.setHeader("cache-control", catalogs.some(group => group.unavailable) ? "s-maxage=30" : "s-maxage=86400, stale-while-revalidate=604800");

    if (!setId) {
      res.end(renderSitemapIndex(sets));
      return;
    }

    const canonicalSetId = canonicalCardSetId(setId);
    const set = sets.find((item) => canonicalCardSetId(item?.id).toLowerCase() === canonicalSetId.toLowerCase());
    if (!set) {
      res.statusCode = 404;
      res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
      return;
    }

    const cards = await fetchCards(set.id);
    res.end(renderCardUrlset(cards));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Unable to generate card sitemap");
  }
};
