const BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";
const SITE_ORIGIN = "https://route25.app";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isoDate(value) {
  const raw = String(value || "").replaceAll("/", "-");
  const date = raw ? new Date(`${raw}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return response.json();
}

async function fetchSets() {
  const payload = await fetchJson(`${BACKEND_ORIGIN}/api/tcg/sets`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

function renderUrlset(sets) {
  const body = sets
    .filter((set) => set?.id)
    .map((set) => {
      const loc = `${SITE_ORIGIN}/sets/${encodeURIComponent(set.id)}`;
      return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${escapeXml(isoDate(set.releaseDate))}</lastmod><changefreq>weekly</changefreq><priority>0.75</priority></url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

module.exports = async (req, res) => {
  try {
    const sets = await fetchSets();
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
