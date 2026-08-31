const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    end(value = "") { this.body = Buffer.isBuffer(value) ? value : String(value); }
  };
}

test("Japanese card pages use the regional catalog without English fallbacks", async () => {
  const cardPage = require("../api/cards");
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          items: [{
            id: "sv9_ja-1",
            name: "Caterpie",
            number: "1",
            printedNumber: "001/100",
            rarity: "Common",
            images: {
              small: "https://assets.tcgdex.net/ja/SV/SV9/001/low.webp",
              large: "https://assets.tcgdex.net/ja/SV/SV9/001/high.png"
            },
            cardVariants: [{
              id: "sv9_ja-1:normal-614852",
              isDefault: true,
              sourceRefs: { tcgplayerProductId: 614852 }
            }],
            set: {
              id: "sv9_ja",
              name: "Battle Partners",
              printedTotal: 100,
              images: { logo: "https://palettetown-backend.vercel.app/set-logos/sv9-ja.png" }
            }
          }]
        };
      }
    };
  };

  try {
    const res = responseRecorder();
    await cardPage({ headers: { host: "route25.test" }, query: { id: "sv9_ja-1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /\/api\/tcg\/by-set\?/);
    assert.match(requestedUrls[0], /region=jp/);
    assert.doesNotMatch(requestedUrls[0], /\/api\/tcg\/cards/);
    assert.match(res.body, /Battle Partners/);
    assert.match(res.body, /Battle Partners Japanese Pokemon Card \| Route 25/);
    assert.match(res.body, /href="\/sets">Browse sets<\/a>/);
    assert.match(res.body, /Pokemon TCG sets/);
    assert.match(res.body, /assets\.tcgdex\.net\/ja\/SV\/SV9\/001\/high\.png/);
    assert.doesNotMatch(res.body, /images\.scrydex\.com\/pokemon\/sv9_ja-1/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Japanese set pages load sets and cards from the regional catalog", async () => {
  const setPage = require("../api/sets");
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    const requested = String(url);
    requestedUrls.push(requested);
    const payload = requested.includes("/api/tcg/sets")
      ? {
          data: [{
            id: "sv9_ja",
            name: "Battle Partners",
            releaseDate: "2025-01-24",
            printedTotal: 100,
            total: 132,
            images: { logo: "https://palettetown-backend.vercel.app/set-logos/sv9-ja.png" }
          }]
        }
      : {
          items: [{
            id: "sv9_ja-1",
            name: "Caterpie",
            number: "1",
            rarity: "Common",
            images: { small: "https://assets.tcgdex.net/ja/SV/SV9/001/low.webp" },
            set: { id: "sv9_ja", name: "Battle Partners" }
          }]
        };
    return { ok: true, async json() { return payload; } };
  };

  try {
    const res = responseRecorder();
    await setPage({ headers: { host: "route25.test" }, query: { id: "sv9_ja" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls.every((url) => url.includes("region=jp")));
    assert.match(res.body, /Battle Partners/);
    assert.match(res.body, /Battle Partners \(2025\) Japanese Pokemon TCG Set List &amp; Cards \| Route 25/);
    assert.match(res.body, /href="\/sets">Browse sets<\/a>/);
    assert.match(res.body, /assets\.tcgdex\.net\/ja\/SV\/SV9\/001\/low\.webp/);
    assert.doesNotMatch(res.body, /images\.scrydex\.com\/pokemon\/sv9_ja-1/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("protected backend previews receive the server-side bypass header", () => {
  const { isJapaneseSetId, route25BackendHeaders, route25BackendUrl } = require("../lib/route25-backend");
  const originalSecret = process.env.ROUTE25_VERCEL_BYPASS_SECRET;
  process.env.ROUTE25_VERCEL_BYPASS_SECRET = "test-secret";
  try {
    assert.equal(isJapaneseSetId("sv9_ja"), true);
    assert.equal(isJapaneseSetId("sv9"), false);
    assert.match(route25BackendUrl("/api/tcg/by-set", "sv9_ja", { set: "sv9_ja" }), /region=jp/);
    assert.equal(
      route25BackendHeaders("https://palettetown-backend.vercel.app/api/tcg/sets")["x-vercel-protection-bypass"],
      "test-secret"
    );
    assert.equal(
      route25BackendHeaders("https://assets.tcgdex.net/ja/SV/SV9/001/low.webp")["x-vercel-protection-bypass"],
      undefined
    );
  } finally {
    if (originalSecret == null) delete process.env.ROUTE25_VERCEL_BYPASS_SECRET;
    else process.env.ROUTE25_VERCEL_BYPASS_SECRET = originalSecret;
  }
});

test("social preview fonts reject protected-deployment HTML before parsing", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "cards", "og.js"), "utf8");
  assert.match(source, /Unexpected font content type/);
  assert.match(source, /contentType\.includes\("font"\)/);
});
