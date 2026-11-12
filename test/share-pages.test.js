const assert = require("node:assert/strict");
const test = require("node:test");
const { buffer } = require("node:stream/consumers");
const { shareKind, themedShareStream } = require("../lib/share-pages");
const trainer = require("../api/trainer-profile");
const config = require("../vercel.json");

test("only public share document routes receive a theme", () => {
  for (const kind of ["collection", "post", "folders", "trade"]) {
    for (const suffix of ["", "/", "/:id", "/:id/"]) {
      const path = "/" + kind + suffix;
      assert.equal(shareKind(path), kind);
      assert.equal(config.rewrites.find(rule => rule.source === path).destination, "/api/backend-proxy.js?path=" + path.slice(1));
    }
  }
  for (const path of ["/api/trainer", "/api/web/posts", "/api/proxy/image", "/collection/id/cards", "/trainer/id", "/web", "/trade-history"]) assert.equal(shareKind(path), "");
});

test("a split UTF-8 head and split body tag retain the share metadata and every byte of the binder", async () => {
  const head = Buffer.from('<html><head><title>Pokémon</title></head>\n');
  const tail = Buffer.from('<main data-name="◓">'.repeat(20000) + "</main></body></html>");
  const split = head.indexOf("é") + 1;
  const chunks = [head.subarray(0, split), head.subarray(split), Buffer.from("<bo"), Buffer.from("dy>"), tail];
  const output = await buffer(themedShareStream(chunks, "collection"));
  assert.ok(output.subarray(-tail.length).equals(tail));
  const prefix = output.subarray(0,-tail.length).toString();
  assert.match(prefix, /<title>Pokémon<\/title>/);
  assert.match(prefix, /share\.css[\s\S]*<\/head>\s*<body class="public-page share-page share-collection">$/);
});

test("trainer profiles escape public data and preserve the app handoff if a profile read fails", async () => {
  const render = async (load, method = "GET", id = "test") => {
    const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, end(body) { this.body = body || ""; } };
    await trainer.createHandler(load)({ method, query: { id } }, res);
    return res;
  };
  const profile = await render(async () => ({ displayName: "A <trainer>", level: 2, completedTradeCount: 1, ownedCardCount: 5, followers: 3, avatarURL: "javascript:alert(1)" }));
  assert.match(profile.body, /<h1>A &lt;trainer&gt;<\/h1>/);
  assert.match(profile.body, /Cards collected/);
  assert.doesNotMatch(profile.body, /javascript:/);
  const unavailable = await render(async () => { throw new Error("private"); });
  assert.match(unavailable.body, /href="route25:\/\/trainer\/test"/);
  assert.doesNotMatch(unavailable.body, /Trainer statistics|private/);
  assert.equal(unavailable.headers["Cache-Control"], "no-store");
  assert.equal((await render(async () => null, "HEAD")).body, "");
  const unexpectedRead = () => assert.fail("unexpected profile read");
  assert.equal((await render(unexpectedRead, "POST")).statusCode, 405);
  assert.equal((await render(unexpectedRead, "GET", "../")).statusCode, 400);
});
