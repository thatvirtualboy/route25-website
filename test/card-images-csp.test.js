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

test("provider-form set URLs resolve through the canonical set fallback", async () => {
  const setPage = require("../api/sets");
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    requestedUrls.push(requestedUrl);
    return {
      ok: true,
      async json() {
        if (requestedUrl.includes("api.tcgdex.net")) {
          return {
            id: "sv05",
            name: "Temporal Forces",
            releaseDate: "2024-03-22",
            cardCount: { official: 162, total: 218 },
            symbol: "https://assets.tcgdex.net/univ/sv/sv05/symbol",
            cards: [{
              id: "sv05-001",
              localId: "001",
              name: "Scyther",
              image: "https://assets.tcgdex.net/en/sv/sv05/001"
            }]
          };
        }
        return { data: [] };
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
    await setPage({ headers: { host: "127.0.0.1:3000" }, query: { id: "sv05" } }, res);

    assert.equal(res.statusCode, 200);
    assert.ok(requestedUrls.some((url) => url.endsWith("/sets/sv05")));
    assert.match(res.body, /Temporal Forces/);
    assert.match(res.body, /https:\/\/127\.0\.0\.1:3000\/sets\/sv5/);
    assert.match(res.body, /sv5-001/);
    assert.doesNotMatch(res.body, /Set not found/);
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

test("hinted physical card detail pages use the fast provider and preserve the clicked front artwork", async () => {
  const cardPage = require("../api/cards");
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          category: "Pokemon",
          id: "base1-44",
          illustrator: "Mitsuhiro Arita",
          image: "https://assets.tcgdex.net/en/base/base1/44",
          localId: "44",
          name: "Bulbasaur",
          set: {
            cardCount: { official: 102, total: 102 },
            id: "base1",
            name: "Base"
          },
          hp: 40,
          types: ["Grass"],
          description: "A strange seed was planted on its back at birth.",
          stage: "Basic",
          attacks: [{ cost: ["Grass", "Grass"], name: "Leech Seed", damage: 20 }],
          retreat: 1
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
      query: {
        id: "base1-44",
        name: "Bulbasaur",
        imageSmall: "https://images.pokemontcg.io/base1/44.png",
        imageLarge: "https://images.pokemontcg.io/base1/44_hires.png"
      }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(requestedUrls, ["https://api.tcgdex.net/v2/en/cards/base1-44"]);
    assert.match(res.body, /class="card-art" src="https:\/\/images\.pokemontcg\.io\/base1\/44\.png"/);
    assert.match(res.body, /Base/);
    assert.match(res.body, /Leech Seed/);
    assert.match(res.body, /Mitsuhiro Arita/);
    assert.match(res.body, /A strange seed was planted on its back at birth\./);
    assert.match(res.body, /class="price-spinner"/);
    assert.match(res.body, /fetch\("\/api\/__proxy\/api\/pricing\/"/);
    assert.match(res.body, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame/);
    assert.doesNotMatch(res.body, /fetch\(backendOrigin \+ "\/api\/pricing\//);
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

test("official Scarlet and Violet card ids map to the fast provider format", async () => {
  const cardPage = require("../api/cards");
  const originalFetch = global.fetch;
  let requestedUrl = "";
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          category: "Trainer",
          id: "sv05-193",
          image: "https://assets.tcgdex.net/en/sv/sv05/193",
          localId: "193",
          name: "Morty's Conviction",
          set: { id: "sv05", name: "Temporal Forces", cardCount: { official: 162, total: 218 } }
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
      query: {
        id: "sv5-193",
        name: "Morty's Conviction",
        imageSmall: "https://images.pokemontcg.io/sv5/193.png",
        imageLarge: "https://images.pokemontcg.io/sv5/193_hires.png"
      }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrl, "https://api.tcgdex.net/v2/en/cards/sv05-193");
    assert.match(res.body, /Morty&#39;s Conviction/);
    assert.match(res.body, /href="\/sets\/sv5">Browse this set/);
  } finally {
    global.fetch = originalFetch;
  }
});
