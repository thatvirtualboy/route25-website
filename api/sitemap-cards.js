const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const SITE_ORIGIN = "https://route25.app";
const { canonicalCardId, canonicalCardSetId } = require("../lib/card-set-id");
const { isJapaneseSetId } = require("../lib/route25-backend");

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return response.json();
}

async function fetchSets() {
  const payload = await fetchJson(`${BACKEND_ORIGIN}/api/tcg/sets`);
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchCards(setId) {
  const payload = await fetchJson(`${BACKEND_ORIGIN}/api/tcg/by-set?set=${encodeURIComponent(setId)}&pageSize=500`);
  return Array.isArray(payload.items) ? payload.items : [];
}

function renderSitemapIndex(sets) {
  const body = sets
    .filter((set) => set?.id && !isJapaneseSetId(set.id))
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
    const sets = await fetchSets();

    res.statusCode = 200;
    res.setHeader("content-type", "application/xml; charset=utf-8");
    res.setHeader("cache-control", "s-maxage=86400, stale-while-revalidate=604800");

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
