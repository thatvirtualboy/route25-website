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
  assert.match(res.body, />Search by card name, then add its card number to narrow the results\.<\/p>/);
  assert.match(res.body, /placeholder="Try Mew 47"/);
  assert.match(res.body, /aria-label="Card language"/);
  assert.match(res.body, /data-region="international" aria-pressed="true">English/);
  assert.match(res.body, /data-region="jp" aria-pressed="false">Japanese/);
  assert.match(res.body, /initialParams\.get\("region"\) === "jp"/);
  assert.match(res.body, /if \(state\.region === "jp"\) params\.set\("region", "jp"\)/);
  assert.match(res.body, /id="resultsSection" hidden/);
  assert.equal((res.body.match(/<a class="fan-card"/g) || []).length, 6);
  assert.match(res.body, /\.fan-card:hover/);
  assert.match(res.body, /class="fan-card" href="\/cards\/me2-125"/);
  assert.doesNotMatch(res.body, /class="fan-card" href="[^"]+\?/);
  assert.match(res.body, /return "\/cards\/" \+ encodeURIComponent\(id\);/);
  assert.doesNotMatch(res.body, /result-actions|result-sub|>Details</);
  assert.match(res.body, /class="result-info"/);
  assert.match(res.body, /card\.set && \(card\.set\.name \|\| card\.set\.id\)/);
  assert.doesNotMatch(res.body, /card-fan:hover \.fan-card:not|opacity: 0\.(?:58|68|72|86|92)/);
  assert.doesNotMatch(res.body, /\.loading \.results-grid/);
  assert.match(res.body, /grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(res.body, /pageSize: 32/);
  assert.match(res.body, /resultsGrid\.innerHTML = "";[\s\S]*resultSummary\.textContent = "Searching cards\.\.\."/);
  assert.match(res.body, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.doesNotMatch(res.body, /debounceTimer/);
  assert.match(res.body, /\/api\/card-search\?q=base1-1&amp;pageSize=1|\/api\/card-search\?q=base1-1&pageSize=1/);
  assert.match(res.body, /src="\/apple-touch-icon\.png"/);
  assert.doesNotMatch(res.body, /images\.pokemontcg\.io\/[^"']+_hires\.png/);
  assert.match(res.body, /loading="lazy" fetchpriority="low" decoding="async"/);
});

test("Japanese card search uses the regional catalog and returns web-ready results", async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    requestedUrls.push(requestedUrl);
    const parsed = new URL(requestedUrl);
    assert.equal(parsed.origin, "https://palettetown-backend.vercel.app");
    assert.equal(parsed.pathname, "/api/tcg/search");
    assert.equal(parsed.searchParams.get("region"), "jp");
    assert.equal(parsed.searchParams.get("q"), "Pikachu");
    assert.equal(parsed.searchParams.get("sort"), "newest");
    assert.equal(parsed.searchParams.has("debug"), false);
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          region: "jp",
          items: [{
            id: "sv9_ja-22",
            name: "Pikachu",
            number: "22",
            images: {
              small: "https://palettetown-backend.vercel.app/api/proxy/card-images/jp/sv9_ja/22/low.webp",
              large: "https://palettetown-backend.vercel.app/api/proxy/card-images/jp/sv9_ja/22/high.png"
            },
            set: { id: "sv9_ja", name: "Battle Partners" }
          }],
          nextCursor: null,
          totalCount: 1
        };
      }
    };
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "Pikachu", region: "jp", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrls.length, 1);
    assert.equal(payload.region, "jp");
    assert.equal(payload.totalCount, 1);
    assert.deepEqual(payload.data[0], {
      id: "sv9_ja-22",
      name: "Pikachu",
      number: "22",
      images: {
        small: "/api/proxy/card-images/jp/sv9_ja/22/low.webp",
        large: "/api/proxy/card-images/jp/sv9_ja/22/high.png"
      },
      set: { id: "sv9_ja", name: "Battle Partners" }
    });
  } finally {
    global.fetch = originalFetch;
  }
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

test("typed searches fall back to an independent API and return render-ready card data", async () => {
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
    assert.deepEqual(Object.keys(payload.data[0]).sort(), ["id", "images", "name", "number"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("a trailing collector number narrows a Pokemon name search", async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    requestedUrls.push(requestedUrl);
    if (requestedUrl === "https://palettetown-backend.vercel.app/api/tcg/sets") {
      throw new Error("Set catalog unavailable");
    }
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/sets")) {
      return { ok: true, async json() { return []; } };
    }
    if (requestedUrl.includes("/api/tcg/by-set")) {
      throw new Error("Supplemental catalog unavailable");
    }
    const cards = [
      { id: "base1-47", localId: "047", name: "Mew", image: "https://assets.tcgdex.net/en/base/base1/47" },
      { id: "promo-147", localId: "147", name: "Mew", image: "https://assets.tcgdex.net/en/base/promo/147" }
    ];
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/cards")) {
      return { ok: true, async json() { return cards; } };
    }
    return {
      ok: true,
      async json() {
        return {
          data: cards.map((card) => ({
            id: card.id,
            name: card.name,
            number: card.localId,
            images: { small: `${card.image}/low.webp` }
          }))
        };
      }
    };
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "mew 47", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);
    const cardSearchUrls = requestedUrls.filter((url) => new URL(url).pathname.endsWith("/cards"));

    assert.equal(res.statusCode, 200);
    assert.ok(cardSearchUrls.every((url) => new URL(url).searchParams.get("q") === "name:*mew* number:47" || url.startsWith("https://api.tcgdex.net")));
    assert.equal(new URL(cardSearchUrls.find((url) => url.startsWith("https://api.tcgdex.net"))).searchParams.get("name"), "mew");
    assert.deepEqual(payload.data.map((card) => card.id), ["base1-47"]);
    assert.equal(payload.data[0].number, "047");
    assert.equal(payload.totalCount, 1);
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

test("empty searches are briefly cached to avoid repeated provider fan-out", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;
  global.fetch = async (url) => {
    requestCount += 1;
    const requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        if (requestedUrl.startsWith("https://api.tcgdex.net")) return [];
        return { data: [], items: [], totalCount: 0 };
      }
    };
  };

  try {
    const first = responseCapture();
    await searchCards({ query: { q: "auditcache-999", pageSize: "32" } }, first);
    const requestsAfterFirstSearch = requestCount;
    const second = responseCapture();
    await searchCards({ query: { q: "auditcache-999", pageSize: "32" } }, second);

    assert.ok(requestsAfterFirstSearch > 0);
    assert.equal(requestCount, requestsAfterFirstSearch);
    assert.deepEqual(JSON.parse(second.body).data, []);
    assert.equal(second.headers["cache-control"], "public, s-maxage=15, stale-while-revalidate=30");
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

test("exact card-id searches discard provider prefix matches", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (!requestedUrl.startsWith("https://api.tcgdex.net")) throw new Error("Fallback provider not needed");
    return {
      ok: true,
      async json() {
        return [
          { id: "base1-4", localId: "4", name: "Charizard", image: "https://assets.tcgdex.net/en/base/base1/4" },
          { id: "base1-40", localId: "40", name: "Raticate", image: "https://assets.tcgdex.net/en/base/base1/40" },
          { id: "base1-44", localId: "44", name: "Bulbasaur", image: "https://assets.tcgdex.net/en/base/base1/44" }
        ];
      }
    };
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "base1-4", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(payload.data.map((card) => card.id), ["base1-4"]);
    assert.equal(payload.totalCount, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("provider-padded search ids become canonical detail links", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (!requestedUrl.startsWith("https://api.tcgdex.net")) throw new Error("Fallback provider not needed");
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/sets")) {
      return { ok: true, async json() { return []; } };
    }
    return {
      ok: true,
      async json() {
        return [{
          id: "sv08.5-015",
          localId: "015",
          name: "Litleo",
          image: "https://assets.tcgdex.net/en/sv/sv08.5/015"
        }];
      }
    };
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "paddedidregression", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(payload.data.map((card) => card.id), ["sv8pt5-15"]);
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
    assert.deepEqual(payload.data.map((card) => card.id), ["sv4pt5-7", "sv3pt5-4"]);
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

test("provider records deduplicate even when a fallback omits number and set metadata", async () => {
  const originalFetch = global.fetch;
  let officialSearchUrl = "";
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (requestedUrl === "https://palettetown-backend.vercel.app/api/tcg/sets") {
      return { ok: true, async json() { return { data: [{ id: "sv8pt5", name: "Prismatic Evolutions", releaseDate: "2025/01/17" }] }; } };
    }
    if (requestedUrl.startsWith("https://palettetown-backend.vercel.app/api/tcg/cards")) {
      return {
        ok: true,
        async json() {
          return { data: [{ id: "sv8pt5-15", name: "Litleo", number: "15", images: { small: "https://images.pokemontcg.io/sv8pt5/15.png" }, set: { id: "sv8pt5", name: "Prismatic Evolutions" } }] };
        }
      };
    }
    if (requestedUrl.startsWith("https://api.pokemontcg.io")) {
      officialSearchUrl = requestedUrl;
      return {
        ok: true,
        async json() {
          return { data: [{ id: "sv08.5-015", name: "Litleo", images: { small: "https://images.pokemontcg.io/sv8pt5/15.png" } }] };
        }
      };
    }
    if (requestedUrl.startsWith("https://api.tcgdex.net")) {
      return { ok: true, async json() { return []; } };
    }
    if (requestedUrl.includes("/api/tcg/by-set")) {
      throw new Error("Supplemental catalog unavailable");
    }
    throw new Error(`Unexpected URL ${requestedUrl}`);
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "provider-dedupe-proof", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(payload.totalCount, 1);
    assert.deepEqual(payload.data.map((card) => card.id), ["sv8pt5-15"]);
    assert.match(new URL(officialSearchUrl).searchParams.get("select"), /number/);
    assert.match(new URL(officialSearchUrl).searchParams.get("select"), /set/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("name searches wait for the complete Route 25 catalog before caching results", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (requestedUrl === "https://palettetown-backend.vercel.app/api/tcg/sets") {
      return {
        ok: true,
        async json() {
          return {
            data: [
              { id: "sv4pt5", name: "Paldean Fates", releaseDate: "2024/01/26" },
              { id: "me5", name: "Pitch Black", releaseDate: "2026/07/17" }
            ]
          };
        }
      };
    }
    if (requestedUrl.startsWith("https://palettetown-backend.vercel.app/api/tcg/cards")) {
      await new Promise((resolve) => setTimeout(resolve, 550));
      return {
        ok: true,
        async json() {
          return {
            data: [
              { id: "sv4pt5-117", name: "Slowbro", number: "117", images: { small: "https://images.pokemontcg.io/sv4pt5/117.png" }, set: { id: "sv4pt5" } },
              { id: "me5-30", name: "Slowbro", number: "30", images: { small: "https://images.scrydex.com/pokemon/me5-30/small" }, set: { id: "me5", name: "Pitch Black" } },
              { id: "me5-31", name: "Mega Slowbro ex", number: "31", images: { small: "https://images.scrydex.com/pokemon/me5-31/small" }, set: { id: "me5", name: "Pitch Black" } },
              { id: "me5-90", name: "Slowbro", number: "90", images: { small: "https://images.scrydex.com/pokemon/me5-90/small" }, set: { id: "me5", name: "Pitch Black" } }
            ],
            totalCount: 4
          };
        }
      };
    }
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/cards")) {
      return {
        ok: true,
        async json() {
          return [{
            id: "sv4pt5-117",
            localId: "117",
            name: "Slowbro",
            image: "https://assets.tcgdex.net/en/sv/sv04.5/117"
          }];
        }
      };
    }
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/sets")) {
      return { ok: true, async json() { return []; } };
    }
    if (requestedUrl.includes("/api/tcg/by-set")) {
      throw new Error("Supplemental catalog unavailable");
    }
    throw new Error("Public fallback not needed");
  };

  try {
    const res = responseCapture();
    await searchCards({ query: { q: "slowbrocatalogwait", pageSize: "32" } }, res);
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(
      payload.data.filter((card) => card.id.startsWith("me5-")).map((card) => card.id),
      ["me5-30", "me5-31", "me5-90"]
    );
    assert.equal(payload.totalCount, 4);
    assert.equal(res.headers["cache-control"], "s-maxage=60, stale-while-revalidate=300");
  } finally {
    global.fetch = originalFetch;
  }
});

test("name searches cap the authoritative catalog wait at the quick-search budget", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (requestedUrl.startsWith("https://palettetown-backend.vercel.app/api/tcg/cards")) {
      await new Promise((resolve) => setTimeout(resolve, 2200));
      return { ok: true, async json() { return { data: [] }; } };
    }
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/cards")) {
      return {
        ok: true,
        async json() {
          return [{
            id: "sv4pt5-117",
            localId: "117",
            name: "Slowbro",
            image: "https://assets.tcgdex.net/en/sv/sv04.5/117"
          }];
        }
      };
    }
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/sets")) {
      return { ok: true, async json() { return []; } };
    }
    if (requestedUrl.includes("/api/tcg/by-set")) {
      throw new Error("Supplemental catalog unavailable");
    }
    throw new Error("Public fallback not needed");
  };

  try {
    const res = responseCapture();
    const startedAt = Date.now();
    await searchCards({ query: { q: "slowbrolatencybudget", pageSize: "32" } }, res);
    const elapsedMs = Date.now() - startedAt;
    const payload = JSON.parse(res.body);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(payload.data.map((card) => card.id), ["sv4pt5-117"]);
    assert.ok(elapsedMs < 1800, `search took ${elapsedMs}ms`);
  } finally {
    global.fetch = originalFetch;
  }
});

test("complete MEP set data supplements missing name and exact-id search records", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const requestedUrl = String(url);
    if (requestedUrl.includes("/api/tcg/by-set") && new URL(requestedUrl).searchParams.get("set") === "mep") {
      return {
        ok: true,
        async json() {
          return {
            data: [
              {
                id: "mep-046",
                name: "Chikorita",
                number: "046",
                rarity: "Promo",
                types: ["Grass"],
                artist: "Saboteri",
                regulationMark: "J",
                images: { small: "https://images.scrydex.com/pokemon/mep-46/small", large: "https://images.scrydex.com/pokemon/mep-46/large" },
                set: { id: "mep", name: "MEP Black Star Promos" }
              },
              {
                id: "mep-054",
                name: "Sobble",
                number: "054",
                rarity: "Promo",
                images: { small: "https://images.scrydex.com/pokemon/mep-54/small", large: "https://images.scrydex.com/pokemon/mep-54/large" },
                set: { id: "mep", name: "MEP Black Star Promos" }
              }
            ]
          };
        }
      };
    }
    if (requestedUrl.startsWith("https://api.tcgdex.net/v2/en/cards")) {
      return { ok: true, async json() { return []; } };
    }
    if (requestedUrl.startsWith("https://palettetown-backend.vercel.app/api/tcg/cards")) {
      return { ok: true, async json() { return { data: [], totalCount: 0 }; } };
    }
    throw new Error("No other provider needed");
  };

  try {
    const nameRes = responseCapture();
    await searchCards({ query: { q: "chikorita", pageSize: "32" } }, nameRes);
    const namePayload = JSON.parse(nameRes.body);
    assert.equal(nameRes.statusCode, 200);
    assert.deepEqual(namePayload.data.map((card) => card.id), ["mep-046"]);
    assert.deepEqual(namePayload.data[0].set, { id: "mep", name: "MEP Black Star Promos" });
    assert.equal(namePayload.data[0].artist, "Saboteri");

    const idRes = responseCapture();
    await searchCards({ query: { q: "mep-054", pageSize: "32" } }, idRes);
    const idPayload = JSON.parse(idRes.body);
    assert.equal(idRes.statusCode, 200);
    assert.deepEqual(idPayload.data.map((card) => card.id), ["mep-054"]);
  } finally {
    global.fetch = originalFetch;
  }
});
