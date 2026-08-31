const test = require("node:test");
const assert = require("node:assert/strict");

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    end(value = "") { this.body = String(value); }
  };
}

test("set directory creates a crawlable hierarchy for international and Japanese sets", async () => {
  const directory = require("../api/set-directory");
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const japanese = new URL(String(url)).searchParams.get("region") === "jp";
    return {
      ok: true,
      async json() {
        return japanese
          ? { data: [{ id: "sv9_ja", name: "Battle Partners", releaseDate: "2025-01-24", printedTotal: 100 }] }
          : { data: [{ id: "sv08.5", name: "Prismatic Evolutions", releaseDate: "2025-01-17", printedTotal: 131 }] };
      }
    };
  };

  try {
    const res = responseCapture();
    await directory({ query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /<link rel="canonical" href="https:\/\/route25\.app\/sets"/);
    assert.match(res.body, /href="\/sets\/sv8pt5"/);
    assert.match(res.body, /href="\/sets\/sv9_ja"/);
    assert.match(res.body, /English and international sets/);
    assert.match(res.body, /Japanese sets/);
    assert.match(res.body, /"@type":"CollectionPage"/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("set directory fails closed when both catalogs are unavailable", async () => {
  const directory = require("../api/set-directory");
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("offline"); };
  try {
    const res = responseCapture();
    await directory({ query: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body, /noindex,nofollow/);
  } finally {
    global.fetch = originalFetch;
  }
});
