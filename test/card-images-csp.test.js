const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { canonicalCardId, canonicalCardSetId, tcgdexCardId, tcgdexCardSetId } = require("../lib/card-set-id");
const { isPokemonTcgPocket, isPokemonTcgPocketCardId, isPokemonTcgPocketSetId } = require("../lib/card-product");

test("provider set ids map to canonical Route 25 set ids", () => {
  assert.equal(canonicalCardSetId("sv05"), "sv5");
  assert.equal(canonicalCardSetId("sv03.5"), "sv3pt5");
  assert.equal(canonicalCardSetId("swsh10.5"), "swsh10pt5");
  assert.equal(tcgdexCardSetId("sv5"), "sv05");
  assert.equal(tcgdexCardSetId("sv3pt5"), "sv03.5");
  assert.equal(canonicalCardId("sv05-193"), "sv5-193");
  assert.equal(tcgdexCardId("sv5-193"), "sv05-193");
});

test("Pokemon TCG Pocket records are recognized across ids, series, and artwork", () => {
  assert.equal(isPokemonTcgPocketSetId("A4"), true);
  assert.equal(isPokemonTcgPocketSetId("P-A"), true);
  assert.equal(isPokemonTcgPocketSetId("sv5"), false);
  assert.equal(isPokemonTcgPocketCardId("A4-173"), true);
  assert.equal(isPokemonTcgPocketCardId("P-A-049"), true);
  assert.equal(isPokemonTcgPocketCardId("base1-44"), false);
  assert.equal(isPokemonTcgPocket({ id: "unknown-1", image: "https://assets.tcgdex.net/en/tcgp/A4/173" }), true);
  assert.equal(isPokemonTcgPocket({ id: "base1-44", image: "https://assets.tcgdex.net/en/base/base1/44" }), false);
});

test("provider-form set URLs permanently redirect to canonical set ids", async () => {
  const setPage = require("../api/sets");
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    throw new Error("redirects must not call a set provider");
  };

  try {
    const res = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
      end(value = "") { this.body = String(value); }
    };
    await setPage({ headers: { host: "127.0.0.1:3000" }, query: { id: "sv05" } }, res);

    assert.equal(res.statusCode, 308);
    assert.equal(res.headers.location, "/sets/sv5");
    assert.equal(res.body, "");
    assert.deepEqual(requestedUrls, []);
  } finally {
    global.fetch = originalFetch;
  }
});

test("production CSP allows every card-image provider", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"),
  );
  const globalHeaders = config.headers.find((item) => item.source === "/(.*)");
  const csp = globalHeaders?.headers.find(
    (header) => header.key === "Content-Security-Policy",
  )?.value;

  const requiredImageSources = [
    "https://images.scrydex.com",
    "https://images.pokemontcg.io",
    "https://assets.tcgdex.net",
    "https://tcgplayer-cdn.tcgplayer.com",
    "https://static.tcgcollector.com",
    "https://firebasestorage.googleapis.com",
    "https://storage.googleapis.com",
    "https://*.googleusercontent.com",
  ];

  const imagePolicy = csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("img-src "));

  for (const source of requiredImageSources) {
    assert.ok(
      imagePolicy.split(/\s+/).includes(source),
      `img-src must allow ${source}`,
    );
  }
});

test("card detail pages have a cross-provider artwork fallback ready before images load", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "api", "cards", "[id].js"),
    "utf8",
  );

  assert.match(source, /images\.scrydex\.com\/pokemon/);
  assert.ok(
    source.indexOf("window.route25CardImageFallback") < source.indexOf('class="card-art"'),
    "the fallback handler must be emitted before the card artwork",
  );
});

test("set pages unwrap proxied artwork and install fallbacks before card images", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "api", "sets", "[id].js"),
    "utf8",
  );

  assert.match(source, /function unwrappedProxyImageUrl/);
  assert.match(source, /images\.scrydex\.com\/pokemon/);
  assert.ok(
    source.indexOf("window.route25CardImageFallback") < source.indexOf('class="set-card-stack"'),
    "the set-page fallback handler must be emitted before card artwork",
  );
});

test("legacy metadata-heavy card URLs permanently redirect before provider lookup", async () => {
  const cardPage = require("../api/cards");
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    throw new Error("redirects must not call a card provider");
  };

  try {
    const res = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
      end(value = "") { this.body = String(value); }
    };
    await cardPage({
      headers: { host: "127.0.0.1:3000" },
      query: {
        id: "base1-44",
        name: "Bulbasaur",
        imageSmall: "https://images.pokemontcg.io/base1/44.png",
        imageLarge: "https://images.pokemontcg.io/base1/44_hires.png"
      }
    }, res);

    assert.equal(res.statusCode, 308);
    assert.equal(res.headers.location, "/cards/base1-44");
    assert.equal(res.body, "");
    assert.deepEqual(requestedUrls, []);
  } finally {
    global.fetch = originalFetch;
  }
});

test("clean physical card URLs render complete card details", async () => {
  const cardPage = require("../api/cards");
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          data: [{
            id: "base1-44",
            name: "Bulbasaur",
            number: "44",
            illustrator: "Mitsuhiro Arita",
            flavorText: "A strange seed was planted on its back at birth.",
            attacks: [{ cost: ["Grass", "Grass"], name: "Leech Seed", damage: "20" }],
            images: {
              small: "https://images.pokemontcg.io/base1/44.png",
              large: "https://images.pokemontcg.io/base1/44_hires.png"
            },
            cardVariants: [{
              id: "base1-44:normal",
              sourceRefs: { tcgplayerProductId: 42412 },
              isDefault: true
            }],
            set: {
              id: "base1",
              name: "Base",
              printedTotal: 102,
              images: { logo: "https://images.pokemontcg.io/base1/logo.png" }
            }
          }]
        };
      }
    };
  };

  try {
    const res = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
      end(value = "") { this.body = String(value); }
    };
    await cardPage({
      headers: { host: "127.0.0.1:3000" },
      query: { id: "base1-44", share: "seo-preview" }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /palettetown-backend\.vercel\.app\/api\/tcg\/cards/);
    assert.match(res.body, /rel="canonical" href="https:\/\/127\.0\.0\.1:3000\/cards\/base1-44"/);
    assert.doesNotMatch(res.body, /rel="canonical"[^>]+share=/);
    assert.match(res.body, /api\/cards\/og\?id=base1-44&amp;v=seo-preview/);
    assert.match(res.body, /class="card-art" src="https:\/\/images\.pokemontcg\.io\/base1\/44(?:_hires)?\.png"/);
    assert.match(res.body, /Leech Seed/);
    assert.match(res.body, /Mitsuhiro Arita/);
    assert.match(res.body, /class="price-spinner"/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Pokemon TCG Pocket card and set pages return not found", async () => {
  const cardPage = require("../api/cards");
  const setPage = require("../api/sets");
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("Pocket ids must be rejected before provider lookup");
  };

  try {
    const cardRes = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
      end(value = "") { this.body = String(value); }
    };
    await cardPage({ headers: { host: "127.0.0.1:3000" }, query: { id: "A4-173" } }, cardRes);
    assert.equal(cardRes.statusCode, 404);
    assert.match(cardRes.body, /Card not found/);

    const setRes = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
      end(value = "") { this.body = String(value); }
    };
    await setPage({ headers: { host: "127.0.0.1:3000" }, query: { id: "A4" } }, setRes);
    assert.equal(setRes.statusCode, 404);
    assert.match(setRes.body, /Set not found/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("provider-form Scarlet and Violet card ids permanently redirect to canonical ids", async () => {
  const cardPage = require("../api/cards");
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("redirects must not call a card provider"); };

  try {
    const res = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
      end(value = "") { this.body = String(value); }
    };
    await cardPage({
      headers: { host: "127.0.0.1:3000" },
      query: { id: "sv05-193" }
    }, res);

    assert.equal(res.statusCode, 308);
    assert.equal(res.headers.location, "/cards/sv5-193");
    assert.equal(res.body, "");
  } finally {
    global.fetch = originalFetch;
  }
});
