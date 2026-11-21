const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const test = require("node:test");

test("released CN catalog serves both pickers, native search, set and exact printing", async (t) => {
  const admin = require("firebase-admin");
  const app = admin.initializeApp({ credential: admin.credential.cert({
    projectId: "palettetown-5064b", clientEmail: "catalog@example.invalid",
    privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" })
  }) });
  t.after(() => app.delete());
  const set = { id: "cbb2c_cn", name: "Gem Pack Volume 2", localized: { name: "宝石包" }, total: 140 };
  const card = { id: "cbb2c_cn-0109", name: "Eevee", number: "0109", printedNumber: "0109/15", set,
    images: { small: "https://img.cardcorpus.com/m/eevee" } };
  const calls = [];
  let signIns = 0;
  t.mock.method(global, "fetch", async (input, options) => {
    const url = new URL(input);
    function result(data) { return { ok: true, status: 200, json: async () => data }; }
    if (url.pathname === "/api/tcg/sets") return result({ data: [] });
    if (url.pathname === "/api/web/firebase-config") return result({ config: { projectId: "palettetown-5064b", apiKey: "fixture" } });
    if (url.host === "identitytoolkit.googleapis.com") {
      assert.equal(url.pathname, "/v1/accounts:signInWithCustomToken");
      assert.ok(JSON.parse(options.body).token);
      signIns++;
      return result({ idToken: "fixture-session", expiresIn: "3600" });
    }
    assert.equal(url.origin, "https://palettetown-backend.vercel.app");
    assert.equal(url.pathname, "/api/cn-pilot");
    assert.equal(url.searchParams.get("edition"), "cn-v1");
    assert.equal(options.headers.authorization, "Bearer fixture-session");
    assert.equal(options.redirect, "error");
    const op = url.searchParams.get("op");
    calls.push(op);
    if (op === "sets") return result({ data: [set] });
    if (op === "card") {
      assert.equal(url.searchParams.get("id"), card.id);
      return result({ data: card });
    }
    if (op === "by-set") assert.equal(url.searchParams.get("set"), set.id);
    if (op === "search") assert.equal(url.searchParams.get("q"), "伊布");
    return result({ items: [card], totalCount: 1 });
  });
  async function page(handler, query) {
    const res = { setHeader() {}, end(body) { this.body = body; } };
    await handler({ headers: { host: "route25.app" }, query }, res);
    assert.equal(res.statusCode, 200);
    return res.body;
  }
  const directory = await page(require("../api/set-directory"), { region: "cn" });
  assert.match(directory, /data-catalog="cn" >/);
  assert.match(directory, /data-region="cn"/);
  assert.match(directory, /href="\/sets\/cbb2c_cn"/);
  const setPage = await page(require("../api/sets"), { id: set.id });
  assert.match(setPage, /href="\/cards\/cbb2c_cn-0109"/);
  const cardPage = await page(require("../api/cards"), { id: card.id });
  assert.match(cardPage, /0109\/15/);
  assert.match(cardPage, /Simplified Chinese Pokemon Card/);
  assert.match(cardPage, /https:\/\/img.cardcorpus.com\/m\/eevee/);
  const results = JSON.parse(await page(require("../api/card-search-data"), { q: "伊布", region: "cn" }));
  assert.equal(results.region, "cn");
  assert.equal(results.data[0].id, card.id);
  assert.deepEqual(calls, ["sets", "sets", "by-set", "card", "search"]);
  assert.equal(signIns, 1);
});
