const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

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

test("card discovery links use canonical paths without metadata query strings", () => {
  const searchPage = fs.readFileSync(path.join(root, "api", "card-search.js"), "utf8");
  const setPage = fs.readFileSync(path.join(root, "api", "sets", "[id].js"), "utf8");

  assert.match(searchPage, /return "\/cards\/" \+ encodeURIComponent\(id\);/);
  assert.doesNotMatch(searchPage, /url\.searchParams\.set\("(?:name|setName|imageSmall|imageLarge)"/);
  assert.match(setPage, /return `\/cards\/\$\{encodeURIComponent\(id\)\}`;/);
  assert.doesNotMatch(setPage, /url\.searchParams\.set\("(?:name|setName|imageSmall|imageLarge)"/);
  assert.match(searchPage, /link\.rel = "prefetch"/);
  assert.match(setPage, /preload\.rel = "prefetch"/);
});

test("public HTML links only use the canonical home URL", () => {
  for (const filename of ["privacy.html", "terms.html", path.join("elite-trainers", "index.html")]) {
    const html = fs.readFileSync(path.join(root, filename), "utf8");
    assert.doesNotMatch(html, /href="\/index\.html"/, `${filename} must not link to /index.html`);
  }

  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  assert.deepEqual(config.redirects.find((item) => item.source === "/index.html"), {
    source: "/index.html",
    destination: "/",
    permanent: true
  });
});

test("the public Elite Trainers page is indexable and self-canonical", () => {
  const html = fs.readFileSync(path.join(root, "elite-trainers", "index.html"), "utf8");
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");

  assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/route25\.app\/elite-trainers\/"/);
  assert.match(sitemap, /<loc>https:\/\/route25\.app\/elite-trainers\/<\/loc>/);
});

test("generated card sitemaps contain only canonical locations", async () => {
  const sitemapCards = require("../api/sitemap-cards");
  const originalFetch = global.fetch;
  global.fetch = async (url) => ({
    ok: true,
    async json() {
      if (String(url).includes("/api/tcg/by-set")) {
        return { items: [{ id: "base1-1" }, { id: "base1-2" }] };
      }
      return { data: [{ id: "base1", name: "Base", releaseDate: "1999/01/09" }] };
    }
  });

  try {
    const indexResponse = responseCapture();
    await sitemapCards({ query: {} }, indexResponse);
    assert.equal(indexResponse.statusCode, 200);
    assert.match(indexResponse.body, /sitemap-cards\.xml\?set=base1/);
    assert.doesNotMatch(indexResponse.body, /<lastmod>|<changefreq>|<priority>/);

    const setResponse = responseCapture();
    await sitemapCards({ query: { set: "base1" } }, setResponse);
    assert.equal(setResponse.statusCode, 200);
    assert.match(setResponse.body, /<loc>https:\/\/route25\.app\/cards\/base1-1<\/loc>/);
    assert.doesNotMatch(setResponse.body, /\?name=|<lastmod>|<changefreq>|<priority>/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("set and static sitemaps omit unsupported or inaccurate update signals", async () => {
  const sitemapSets = require("../api/sitemap-sets");
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { data: [{ id: "base1", name: "Base", releaseDate: "1999/01/09" }] };
    }
  });

  try {
    const res = responseCapture();
    await sitemapSets({ query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /<loc>https:\/\/route25\.app\/sets\/base1<\/loc>/);
    assert.doesNotMatch(res.body, /<lastmod>|<changefreq>|<priority>/);
  } finally {
    global.fetch = originalFetch;
  }

  const staticSitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.doesNotMatch(staticSitemap, /<lastmod>|<changefreq>|<priority>/);
});
