const assert = require("node:assert/strict");
const test = require("node:test");
const { proxyTargetUrl } = require("../scripts/local-server");

test("local preview mirrors production backend rewrites", () => {
  assert.equal(
    proxyTargetUrl("/api/proxy/image", "?u=https%3A%2F%2Fimages.pokemontcg.io%2Fsm9%2F1.png"),
    "https://palettetown-backend.vercel.app/api/proxy/image?u=https%3A%2F%2Fimages.pokemontcg.io%2Fsm9%2F1.png"
  );
  assert.equal(
    proxyTargetUrl("/api/__proxy/set-logos/sm9.png"),
    "https://palettetown-backend.vercel.app/set-logos/sm9.png"
  );
  assert.equal(
    proxyTargetUrl("/api/__proxy/api/pricing/sv4pt5-007"),
    "https://palettetown-backend.vercel.app/api/pricing/sv4pt5-007"
  );
  assert.equal(
    proxyTargetUrl("/card-images/mep/mep-039.webp"),
    "https://palettetown-backend.vercel.app/card-images/mep/mep-039.webp"
  );
});
