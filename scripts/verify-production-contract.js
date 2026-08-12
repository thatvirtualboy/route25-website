const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const renderSearchPage = require(path.join(root, "api", "card-search.js"));
const searchCards = require(path.join(root, "api", "card-search-data.js"));

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
    },
  };
}

function rewriteFor(source) {
  return vercelConfig.rewrites.find((rewrite) => rewrite.source === source);
}

async function main() {
  assert.deepEqual(rewriteFor("/search"), {
    source: "/search",
    destination: "/api/card-search.js",
  });
  assert.deepEqual(rewriteFor("/api/card-search"), {
    source: "/api/card-search",
    destination: "/api/card-search-data.js",
  });

  const pageResponse = responseCapture();
  await renderSearchPage({ query: {} }, pageResponse);
  assert.equal(pageResponse.statusCode, 200);
  assert.equal((pageResponse.body.match(/<a class="fan-card"/g) || []).length, 6);
  assert.doesNotMatch(pageResponse.body, /setSelect|All sets/);
  assert.match(pageResponse.body, /pageSize: 32/);
  assert.match(pageResponse.body, /repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(pageResponse.body, /src="\/apple-touch-icon\.png"/);
  assert.doesNotMatch(pageResponse.body, /images\.pokemontcg\.io\/[^"']+_hires\.png/);

  const blankSearchResponse = responseCapture();
  await searchCards({ query: {} }, blankSearchResponse);
  assert.equal(blankSearchResponse.statusCode, 200);
  assert.equal(blankSearchResponse.headers["cache-control"], "no-store");
  assert.deepEqual(JSON.parse(blankSearchResponse.body), {
    ok: true,
    data: [],
    page: 1,
    pageSize: 24,
    count: 0,
    totalCount: 0,
  });

  process.stdout.write("Production contract verified.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
