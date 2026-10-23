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
  const html = "<!doctype html><html><body>Shared collection: Pokémon</body></html>";
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
        assert.equal(await response.text(), html);
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
