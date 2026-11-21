const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { syncHeaders } = require("../scripts/sync-site-header");
const { renderSiteHeader } = require("../lib/site-header");
const { createLocalServer } = require("../scripts/local-server");
const browse = require("../api/browse");

function responseCapture() {
  return {
    statusCode: 0, headers: {}, body: "",
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = "") { this.body = String(body); }
  };
}

test("static public headers stay in sync with the shared template", () => syncHeaders(true));

test("Browse serves card search immediately and preserves search state between views", async () => {
  const originalFetch = global.fetch;
  global.fetch = () => { throw new Error("Cards view must not wait for set catalogs"); };
  try {
    const res = responseCapture();
    await browse({ query: { q: 'Mew & "friends"', region: "jp", page: "2" } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes(renderSiteHeader("browse")));
    assert.equal((res.body.match(/class="site-header"/g) || []).length, 1);
    assert.match(res.body, /id="cardQuery"/);
    assert.match(res.body, /href="\/browse\?q=Mew\+%26\+%22friends%22&amp;region=jp&amp;page=2&amp;view=sets"/);
  } finally { global.fetch = originalFetch; }
});

test("Browse Sets renders crawlable regional sets with the same primary header", async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => ({ ok: true, json: async () => ({ data: new URL(url).searchParams.get("region") === "jp"
    ? [{ id: "sv9_ja", name: "Battle Partners" }]
    : [{ id: "base1", name: "Base Set" }] }) });
  try {
    const res = responseCapture();
    await browse({ query: { view: "sets", q: "Mew", region: "jp" } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes(renderSiteHeader("browse")));
    assert.equal((res.body.match(/class="site-header"/g) || []).length, 1);
    assert.match(res.body, /href="\/sets\/base1"/);
    assert.match(res.body, /href="\/sets\/sv9_ja"/);
    assert.match(res.body, /href="\/browse\?q=Mew&amp;region=jp">Cards/);
  } finally { global.fetch = originalFetch; }
});

test("legacy entry points redirect without losing query, language, or page", () => {
  const server = createLocalServer();
  for (const [url, destination] of [
    ["/search?q=Mew+47&region=jp&page=2", "/browse?q=Mew+47&region=jp&page=2"],
    ["/search/", "/browse"],
    ["/sets?filter=Base", "/browse?filter=Base&view=sets"],
    ["/sets/", "/browse?view=sets"]
  ]) {
    const res = responseCapture();
    server.emit("request", { url, method: "GET", headers: { host: "localhost" } }, res);
    assert.equal(res.statusCode, 308);
    assert.equal(res.headers.location, destination);
  }
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"));
  assert.equal(config.rewrites.find(item => item.source === "/browse").destination, "/api/browse.js");
  for (const route of ["/search", "/search/", "/sets", "/sets/"]) {
    const redirect = config.redirects.find(item => item.source === route);
    assert.equal(redirect.destination, route.startsWith("/sets") ? "/browse?view=sets" : "/browse");
    assert.equal(redirect.permanent, true);
  }
});
