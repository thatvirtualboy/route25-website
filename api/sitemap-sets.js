const SITE_ORIGIN = "https://route25.app";
const { loadSetCatalogs } = require("../lib/set-catalogs");
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
    const catalogs = await loadSetCatalogs();
    const sets = catalogs.flatMap(group => group.sets);
    if (!sets.length) throw new Error("No set catalogs available");
    res.statusCode = 200;
    res.setHeader("content-type", "application/xml; charset=utf-8");
    res.setHeader("cache-control", catalogs.some(group => group.unavailable) ? "s-maxage=30" : "s-maxage=86400, stale-while-revalidate=604800");
    res.end(renderUrlset(sets));
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Unable to generate set sitemap");
  }
};
