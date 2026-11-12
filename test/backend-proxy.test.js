const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { brotliCompressSync, gzipSync, deflateSync } = require("node:zlib");
const test = require("node:test");
const proxy = require("../api/backend-proxy");

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("share proxy serves decodable HTML for compressed and plain upstream responses", async (t) => {
  const html = "<!doctype html><html><head><title>Pokémon</title></head><body>Shared collection: Pokémon</body></html>";
  const originalOrigin = process.env.ROUTE25_BACKEND_ORIGIN;
  let encoding;
  let body;
  const upstream = http.createServer((req, res) => {
    assert.equal(req.url, "/collection/test-trainer?token=test-share-token");
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "private, max-age=60");
    res.setHeader("content-length", body.length);
    if (encoding) res.setHeader("content-encoding", encoding);
    res.end(body);
  });
  const downstream = http.createServer((req, res) => {
    req.query = { path: "collection/test-trainer", token: "test-share-token" };
    proxy(req, res).catch((error) => res.destroy(error));
  });

  try {
    process.env.ROUTE25_BACKEND_ORIGIN = await listen(upstream);
    const url = await listen(downstream);
    for (const [name, compress] of [
      ["br", brotliCompressSync],
      ["gzip", gzipSync],
      ["deflate", deflateSync],
      [undefined, (value) => value],
    ]) {
      await t.test(name || "uncompressed", async () => {
        encoding = name;
        body = compress(Buffer.from(html));
        const response = await fetch(url);
        assert.equal(response.status, 200);
        // Consume the response as a browser would; stale encoding headers break this.
        const page = await response.text();
        assert.match(page, /<title>Pokémon<\/title>/);
        assert.match(page, /href="\/assets\/share\.css"/);
        assert.match(page, /<body class="public-page share-page share-collection">Shared collection: Pokémon/);
        assert.equal(response.headers.get("content-encoding"), null);
        assert.equal(response.headers.get("content-length"), null);
        assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
        assert.equal(response.headers.get("cache-control"), "private, max-age=60");
      });
    }
  } finally {
    if (originalOrigin === undefined) delete process.env.ROUTE25_BACKEND_ORIGIN;
    else process.env.ROUTE25_BACKEND_ORIGIN = originalOrigin;
    await close(downstream);
    await close(upstream);
  }
});

test("share links keep JSON, missing-token status, redirects and HEAD semantics", async () => {
  const originalOrigin = process.env.ROUTE25_BACKEND_ORIGIN;
  const upstream = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.get("format") === "json") {
      res.writeHead(200, { "Content-Type": "application/json", "ETag": '"json"', "Cache-Control": "private, max-age=60" }).end('{"ok":true}');
    } else if (url.searchParams.has("redirect")) {
      res.writeHead(302, { Location: "/open" }).end();
    } else if (!url.searchParams.has("token")) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Collection not found");
    } else {
      res.writeHead(200, { "Content-Type": "text/html", "ETag": '"old-html"' }).end("<html><head></head><body>cards</body></html>");
    }
  });
  const downstream = http.createServer((req, res) => {
    req.query = { ...Object.fromEntries(new URL(req.url, "http://localhost").searchParams), path: "collection/test" };
    proxy(req, res).catch(error => res.destroy(error));
  });
  try {
    process.env.ROUTE25_BACKEND_ORIGIN = await listen(upstream);
    const url = await listen(downstream);
    const json = await fetch(url + "/?token=example&format=json");
    assert.deepEqual(await json.json(), { ok: true });
    assert.equal(json.headers.get("etag"), '"json"');
    const miss = await fetch(url, { headers: { accept: "text/html" } });
    assert.equal(miss.status, 404);
    assert.match(await miss.text(), /<h1>Collection unavailable<\/h1>/);
    assert.equal(miss.headers.get("referrer-policy"), "no-referrer");
    const text = await fetch(url);
    assert.equal(await text.text(), "Collection not found");
    const redirect = await fetch(url + "/?redirect", { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), "/open");
    const head = await fetch(url + "/?token=example", { method: "HEAD" });
    assert.equal(head.headers.get("etag"), null);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  } finally {
    if (originalOrigin === undefined) delete process.env.ROUTE25_BACKEND_ORIGIN;
    else process.env.ROUTE25_BACKEND_ORIGIN = originalOrigin;
    await close(downstream);
    await close(upstream);
  }
});
