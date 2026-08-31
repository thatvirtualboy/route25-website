const SITE_ORIGIN = "https://route25.app";
const { isJapaneseSetId, route25BackendHeaders, route25BackendUrl } = require("../lib/route25-backend");
const { canonicalCardSetId } = require("../lib/card-set-id");
const { isPokemonTcgPocket } = require("../lib/card-product");

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

async function fetchSets(setId = "") {
  const payload = await fetchJson(route25BackendUrl("/api/tcg/sets", setId));
  return Array.isArray(payload?.data) ? payload.data : [];
}

function renderUrlset(sets) {
  const ids = [...new Set(sets
    .filter((set) => set?.id && !isPokemonTcgPocket(set))
    .map((set) => canonicalCardSetId(set.id))
    .filter(Boolean))];
  const body = ids
    .map((setId) => {
      const loc = `${SITE_ORIGIN}/sets/${encodeURIComponent(setId)}`;
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
    const [internationalResult, japaneseResult] = await Promise.allSettled([
      fetchSets(),
      fetchSets("catalog_ja")
    ]);
    const international = internationalResult.status === "fulfilled" ? internationalResult.value : [];
    const japanese = japaneseResult.status === "fulfilled" ? japaneseResult.value : [];
    const sets = [
      ...international.filter((set) => !isJapaneseSetId(set?.id)),
      ...japanese.filter((set) => isJapaneseSetId(set?.id))
    ];
    if (!sets.length) throw new Error("No set catalogs available");
    res.statusCode = 200;
    res.setHeader("content-type", "application/xml; charset=utf-8");
    res.setHeader("cache-control", "s-maxage=86400, stale-while-revalidate=604800");
    res.end(renderUrlset(sets));
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Unable to generate set sitemap");
  }
};
