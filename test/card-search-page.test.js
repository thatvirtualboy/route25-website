const test = require("node:test");
const assert = require("node:assert/strict");

const renderSearchPage = require("../api/card-search");
const searchCards = require("../api/card-search-data");

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(value = "") {
      this.body = String(value);
    }
  };
}

test("card search page stays focused on individual-card search", async () => {
  const res = responseCapture();
  await renderSearchPage({ query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(res.body, /setSelect|Open this set|All sets/);
  assert.match(res.body, /id="cardQuery"/);
  assert.match(res.body, /id="resultsSection" hidden/);
  assert.equal((res.body.match(/<a class="fan-card"/g) || []).length, 6);
  assert.match(res.body, /\.fan-card:hover/);
  assert.match(res.body, /\/cards\/me2-125\?/);
  assert.doesNotMatch(res.body, /result-actions|result-sub|>Details</);
  assert.doesNotMatch(res.body, /card-fan:hover \.fan-card:not|opacity: 0\.(?:58|68|72|86|92)/);
  assert.doesNotMatch(res.body, /\.loading \.results-grid/);
  assert.match(res.body, /grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(res.body, /pageSize: 32/);
  assert.match(res.body, /resultsGrid\.innerHTML = "";[\s\S]*resultSummary\.textContent = "Searching cards\.\.\."/);
  assert.match(res.body, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.doesNotMatch(res.body, /debounceTimer/);
  assert.match(res.body, /\/api\/card-search\?q=base1-1&amp;pageSize=1|\/api\/card-search\?q=base1-1&pageSize=1/);
});

test("blank card search does not fall back to browsing the newest set", async () => {
  const res = responseCapture();
  await searchCards({ query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    ok: true,
    data: [],
    page: 1,
    pageSize: 24,
    count: 0,
    totalCount: 0
  });
});

test("typed searches fall back to an independent API and return image-only card data", async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    requestedUrls.push(requestedUrl);
    if (requestedUrl.startsWith("https://palettetown-backend.vercel.app") || requestedUrl.startsWith("https://api.pokemontcg.io")) {
      throw new Error("Primary search unavailable");
    }
    return {
      ok: true,
      async json() {
        if (requestedUrl.startsWith("https://api.tcgdex.net")) {
          return [{
            id: "base1-44",
            localId: "44",
            name: "Bulbasaur",
            image: "https://assets.tcgdex.net/en/base/base1/44"
          }];
        }
        return {
          data: [{
            id: "base1-44",
            name: "Bulbasaur",
            number: "44",
            rarity: "Common",
            images: {
              small: "https://images.pokemontcg.io/base1/44.png",
              large: "https://images.pokemontcg.io/base1/44_hires.png"
            },
            set: { id: "base1", name: "Base" }
          }],
          page: 1,
          pageSize: 16,
          count: 1,
          totalCount: 1
        };
      }
    };
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "bulbas", pageSize: "16" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.ok(requestedUrls.filter((url) => !url.startsWith("https://api.tcgdex.net")).every((url) => /%2A/.test(url)));
    assert.ok(requestedUrls.some((url) => url.startsWith("https://api.tcgdex.net/v2/en/cards")));
    assert.ok(requestedUrls.filter((url) => !url.startsWith("https://api.tcgdex.net")).every((url) => new URL(url).searchParams.get("q") === "name:*bulbas*"));
    assert.deepEqual(Object.keys(payload.data[0]).sort(), ["id", "images", "name"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fallback searches report an exact total instead of estimating another page", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (!requestedUrl.startsWith("https://api.tcgdex.net")) {
      throw new Error("Primary search unavailable");
    }
    return {
      ok: true,
      async json() {
        return Array.from({ length: 30 }, (_, index) => ({
          id: `test-${index + 1}`,
          localId: String(index + 1),
          name: "Jolteon",
          image: `https://assets.tcgdex.net/en/test/test/${index + 1}`
        }));
      }
    };
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "paginationtest", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.equal(payload.data.length, 30);
    assert.equal(payload.totalCount, 30);
    assert.equal(payload.pageSize, 32);
  } finally {
    global.fetch = originalFetch;
  }
});

test("exact card-id searches map canonical set ids for the preferred provider", async () => {
  const originalFetch = global.fetch;
  let preferredUrl = "";
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (requestedUrl.startsWith("https://api.tcgdex.net")) {
      preferredUrl = requestedUrl;
      return {
        ok: true,
        async json() {
          return [{
            id: "sv05-193",
            localId: "193",
            name: "Morty's Conviction",
            image: "https://assets.tcgdex.net/en/sv/sv05/193"
          }];
        }
      };
    }
    throw new Error("Fallback provider not needed");
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "sv5-193", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.equal(new URL(preferredUrl).searchParams.get("id"), "sv05-193");
    assert.equal(payload.data[0].id, "sv5-193");
  } finally {
    global.fetch = originalFetch;
  }
});

test("multi-word card names match without requiring provider punctuation", async () => {
  const originalFetch = global.fetch;
  let preferredUrl = "";
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (!requestedUrl.startsWith("https://api.tcgdex.net")) throw new Error("Fallback provider not needed");
    preferredUrl = requestedUrl;
    return {
      ok: true,
      async json() {
        return [
          { id: "base2-6", name: "Mr. Mime", image: "https://assets.tcgdex.net/en/base/base2/6" },
          { id: "ecard3-100", name: "Mr. Stone's Project", image: "https://assets.tcgdex.net/en/ecard/ecard3/100" }
        ];
      }
    };
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "mr mime", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(new URL(preferredUrl).searchParams.get("name"), "mr");
    assert.deepEqual(payload.data.map((card) => card.name), ["Mr. Mime"]);
    assert.equal(payload.totalCount, 1);
  } finally {
    global.fetch = originalFetch;
  }
});
