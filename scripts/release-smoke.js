const assert = require("node:assert/strict");

const baseUrl = String(process.env.ROUTE25_AUDIT_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

async function timedFetch(pathname, options) {
  const url = new URL(pathname, baseUrl);
  const startedAt = Date.now();
  const response = await fetch(url, options);
  return { response, elapsedMs: Date.now() - startedAt, url };
}

async function fetchJson(pathname, maximumMs = 3000) {
  const result = await timedFetch(pathname, { headers: { accept: "application/json" } });
  assert.equal(result.response.status, 200, `${result.url.pathname} must return 200`);
  assert.ok(result.elapsedMs <= maximumMs, `${result.url.pathname} took ${result.elapsedMs}ms`);
  return { ...result, payload: await result.response.json() };
}

async function fetchHtml(pathname, maximumMs = 3000) {
  const result = await timedFetch(pathname, { headers: { accept: "text/html" } });
  assert.equal(result.response.status, 200, `${result.url.pathname} must return 200`);
  assert.ok(result.elapsedMs <= maximumMs, `${result.url.pathname} took ${result.elapsedMs}ms`);
  return { ...result, html: await result.response.text() };
}

async function assertImage(value, label) {
  const url = new URL(value, baseUrl);
  const response = await fetch(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, `${label} must return 200`);
  assert.match(response.headers.get("content-type") || "", /^image\//, `${label} must return an image`);
  assert.ok(bytes.length > 1000, `${label} must contain real image bytes`);
  return { bytes: bytes.length, url: url.href };
}

function imageHints(card) {
  return new URLSearchParams({
    name: card.name,
    imageSmall: card.images.small,
    imageLarge: card.images.large || card.images.small
  });
}

async function main() {
  const report = { baseUrl, searches: {}, images: {} };
  const searchPage = await fetchHtml("/search");
  assert.equal((searchPage.html.match(/<a class="fan-card"/g) || []).length, 6, "search fan must contain six cards");
  assert.doesNotMatch(searchPage.html, /setSelect|All sets/, "set picker must remain removed");
  assert.match(searchPage.html, /pageSize: 32/, "desktop search must request 32 cards");
  assert.match(searchPage.html, /repeat\(8, minmax\(0, 1fr\)\)/, "desktop grid must use eight columns");

  const fanImages = Array.from(searchPage.html.matchAll(/<a class="fan-card"[\s\S]*?<img src="([^"]+)"/g), (match) => match[1]);
  assert.equal(fanImages.length, 6, "all fan cards must have artwork");
  report.images.fanFirst = await assertImage(fanImages[0], "first fan card");
  report.images.fanLast = await assertImage(fanImages.at(-1), "last fan card");

  for (const query of ["bulbas", "snorlax", "jolteon", "mr mime", "sv5-193"]) {
    const result = await fetchJson(`/api/card-search?q=${encodeURIComponent(query)}&page=1&pageSize=32`);
    assert.equal(result.payload.ok, true, `${query} search must succeed`);
    assert.ok(Array.isArray(result.payload.data) && result.payload.data.length > 0, `${query} search must return cards`);
    assert.ok(result.payload.data.every((card) => card.id && card.name && card.images?.small), `${query} results must be clickable images`);
    report.searches[query] = {
      elapsedMs: result.elapsedMs,
      returned: result.payload.data.length,
      total: result.payload.totalCount
    };
  }

  const jolteonPage1 = await fetchJson("/api/card-search?q=jolteon&page=1&pageSize=32");
  const jolteonTotal = jolteonPage1.payload.totalCount;
  const jolteonIds = new Set(jolteonPage1.payload.data.map((card) => card.id));
  if (jolteonTotal > 32) {
    const jolteonPage2 = await fetchJson("/api/card-search?q=jolteon&page=2&pageSize=32");
    assert.equal(jolteonPage2.payload.totalCount, jolteonTotal, "pagination total must remain stable");
    assert.ok(jolteonPage2.payload.data.every((card) => !jolteonIds.has(card.id)), "pagination must not duplicate cards");
    if (jolteonTotal <= 64) {
      assert.equal(jolteonPage1.payload.data.length + jolteonPage2.payload.data.length, jolteonTotal, "page counts must equal the total");
    }
  }

  const exactSearch = await fetchJson("/api/card-search?q=sv5-193&page=1&pageSize=32");
  const exactCard = exactSearch.payload.data[0];
  const detailPath = `/cards/${encodeURIComponent(exactCard.id)}?${imageHints(exactCard)}`;
  const detail = await fetchHtml(detailPath, 2000);
  const artwork = detail.html.match(/<img class="card-art" src="([^"]+)"/i)?.[1];
  const highResolutionArtwork = detail.html.match(/data-hires-candidates="([^"|]+)/i)?.[1];
  const setPath = detail.html.match(/href="(\/sets\/[^"]+)"[^>]*>Browse this set/i)?.[1];
  assert.ok(artwork, "card detail must render artwork");
  assert.ok(highResolutionArtwork, "card detail must provide high-resolution artwork");
  assert.ok(setPath, "card detail must render Browse this set");
  report.cardDetailMs = detail.elapsedMs;
  report.images.cardDetail = await assertImage(artwork, "card detail artwork");
  report.images.cardDetailHighResolution = await assertImage(highResolutionArtwork, "high-resolution card detail artwork");

  const setPage = await fetchHtml(setPath, 4000);
  assert.doesNotMatch(setPage.html, /Set not found|We could not find/i, "Browse this set must resolve");
  const setCardMatch = setPage.html.match(/<a class="set-card"[^>]*>[\s\S]*?<img src="([^"]+)"/i);
  assert.ok(setCardMatch?.[1], "set page must render card artwork");
  report.setPageMs = setPage.elapsedMs;
  report.images.setCard = await assertImage(setCardMatch[1], "set card artwork");

  const teamUp = await fetchHtml("/sets/sm9", 4000);
  const teamUpImage = teamUp.html.match(/https:\/\/images\.pokemontcg\.io\/sm9\/1\.png/)?.[0];
  assert.ok(teamUpImage, "legacy backend sets must expose direct artwork fallbacks");
  report.teamUpMs = teamUp.elapsedMs;
  report.images.teamUp = await assertImage(teamUpImage, "Team Up artwork");

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
