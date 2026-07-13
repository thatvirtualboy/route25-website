const test = require("node:test");
const assert = require("node:assert/strict");
const { route25ImageUrl } = require("../lib/route25-image-url");

test("keeps backend proxy images on the Route 25 origin", () => {
  assert.equal(
    route25ImageUrl("https://palettetown-backend.vercel.app/api/proxy/image?u=https%3A%2F%2Fimages.pokemontcg.io%2Fme1%2F1.png"),
    "/api/proxy/image?u=https%3A%2F%2Fimages.pokemontcg.io%2Fme1%2F1.png"
  );
});

test("keeps local card images on the Route 25 origin", () => {
  assert.equal(
    route25ImageUrl("https://palettetown-backend.vercel.app/card-images/svp/svp-500.webp"),
    "/card-images/svp/svp-500.webp"
  );
});

test("routes other backend image assets through the same-origin backend rewrite", () => {
  assert.equal(
    route25ImageUrl("https://palettetown-backend.vercel.app/set-logos/me1.png"),
    "/api/__proxy/set-logos/me1.png"
  );
});

test("leaves approved third-party image sources unchanged", () => {
  assert.equal(
    route25ImageUrl("https://images.scrydex.com/pokemon/me4-1/small"),
    "https://images.scrydex.com/pokemon/me4-1/small"
  );
});

test("preserves already-relative backend image paths", () => {
  assert.equal(route25ImageUrl("/api/proxy/image?u=test"), "/api/proxy/image?u=test");
  assert.equal(route25ImageUrl("/card-images/mep/mep-001.webp"), "/card-images/mep/mep-001.webp");
});
