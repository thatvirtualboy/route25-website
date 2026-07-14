const test = require("node:test");
const assert = require("node:assert/strict");
const { route25CardUrl } = require("../lib/newsletter-products");

test("Route 25 card links accept only canonical card-detail URLs", () => {
  assert.equal(route25CardUrl("https://route25.app/cards/base1-4"), "https://route25.app/cards/base1-4");
  assert.equal(route25CardUrl("https://route25.app/cards/base1-4/?variant=holo"), "https://route25.app/cards/base1-4?variant=holo");
  assert.equal(route25CardUrl("https://route25.app/search?q=Pikachu"), "");
  assert.equal(route25CardUrl("https://example.com/cards/base1-4"), "");
  assert.equal(route25CardUrl("javascript:alert(1)"), "");
});
