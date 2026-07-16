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
  assert.match(res.body, />Search by card name\.<\/p>/);
  assert.doesNotMatch(res.body, /card number, or id/i);
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
    const fallbackCardUrls = requestedUrls.filter((url) => {
      if (url.startsWith("https://api.tcgdex.net")) return false;
      return new URL(url).pathname.endsWith("/cards");
    });

    assert.equal(res.statusCode, 200);
    assert.ok(fallbackCardUrls.every((url) => /%2A/.test(url)));
    assert.ok(requestedUrls.some((url) => url.startsWith("https://api.tcgdex.net/v2/en/cards")));
    assert.ok(fallbackCardUrls.every((url) => new URL(url).searchParams.get("q") === "name:*bulbas*"));
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

test("search results exclude Pokemon TCG Pocket cards", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (!requestedUrl.startsWith("https://api.tcgdex.net")) throw new Error("Fallback provider not needed");
    return {
      ok: true,
      async json() {
        return [
          {
            id: "P-A-007",
            localId: "007",
            name: "Professor's Research",
            image: "https://assets.tcgdex.net/en/tcgp/P-A/007"
          },
          {
            id: "swsh1-178",
            localId: "178",
            name: "Professor's Research",
            image: "https://assets.tcgdex.net/en/swsh/swsh1/178"
          }
        ];
      }
    };
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "professor", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(payload.data.map((card) => card.id), ["swsh1-178"]);
    assert.equal(payload.totalCount, 1);
    assert.doesNotMatch(JSON.stringify(payload), /tcgp|P-A-007/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test("broad card-name searches sort the full result set newest first", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (requestedUrl === "https://palettetown-backend.vercel.app/api/tcg/sets") {
      return {
        ok: true,
        async json() {
          return {
            data: [
              { id: "det1", name: "Detective Pikachu", releaseDate: "2019/04/05" },
              { id: "sv3pt5", name: "151", releaseDate: "2023/09/22" },
              { id: "sv4pt5", name: "Paldean Fates", releaseDate: "2024/01/26" }
            ]
          };
        }
      };
    }
    if (requestedUrl.startsWith("https://api.tcgdex.net")) {
      return {
        ok: true,
        async json() {
          return [
            { id: "det1-4", localId: "4", name: "Charmander", image: "https://assets.tcgdex.net/en/sm/det1/4" },
            { id: "sv3pt5-004", localId: "004", name: "Charmander", image: "https://assets.tcgdex.net/en/sv/sv03.5/004" },
            { id: "sv4pt5-007", localId: "007", name: "Charmander", image: "https://assets.tcgdex.net/en/sv/sv04.5/007" }
          ];
        }
      };
    }
    throw new Error("Fallback card provider not needed");
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "newestordertest", pageSize: "2" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(payload.data.map((card) => card.id), ["sv4pt5-007", "sv3pt5-004"]);
    assert.equal(payload.totalCount, 3);
  } finally {
    global.fetch = originalFetch;
  }
});

test("broad searches merge physical-card providers and keep only usable front artwork", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/cards")) {
      return {
        ok: true,
        async json() {
          return [
            { id: "sv7-148", localId: "148", name: "Squirtle", image: "https://assets.tcgdex.net/en/sv/sv07/148" },
            { id: "mep-039", localId: "039", name: "Squirtle", image: null },
            { id: "mfb-25", localId: "25", name: "Squirtle", image: null },
            { id: "A1-053", localId: "053", name: "Squirtle", image: "https://assets.tcgdex.net/en/tcgp/A1/053" }
          ];
        }
      };
    }
    if (requestedUrl.startsWith("https://palettetown-backend.vercel.app/api/tcg/cards")) {
      return {
        ok: true,
        async json() {
          return {
            data: [
              { id: "sv7-148", name: "Squirtle", number: "148", images: { small: "https://images.pokemontcg.io/sv7/148.png" }, set: { id: "sv7" } },
              { id: "mcd21-17", name: "Squirtle", number: "17", images: { small: "https://images.pokemontcg.io/mcd21/17.png" }, set: { id: "mcd21" } }
            ],
            totalCount: 2
          };
        }
      };
    }
    if (requestedUrl === "https://palettetown-backend.vercel.app/api/tcg/sets") {
      return { ok: true, async json() { return { data: [] }; } };
    }
    throw new Error("Slow public fallback not needed");
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "providermergetest", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);
    const ids = payload.data.map((card) => card.id);

    assert.equal(res.statusCode, 200);
    assert.equal(payload.totalCount, 3);
    assert.deepEqual(new Set(ids), new Set(["sv7-148", "mcd21-17", "mep-039"]));
    assert.equal(ids.filter((id) => id === "sv7-148").length, 1);
    assert.doesNotMatch(JSON.stringify(payload), /A1-053|mfb-25|tcgp/i);
    assert.match(payload.data.find((card) => card.id === "mep-039").images.small, /card-images\/mep\/mep-039\.webp/);
  } finally {
    global.fetch = originalFetch;
  }
});
