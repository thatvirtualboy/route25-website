const test = require("node:test");
const assert = require("node:assert/strict");
const { isPrivateRelayEmail } = require("../lib/newsletter-subscriber");

test("identifies Apple private relay newsletter addresses", () => {
  assert.equal(isPrivateRelayEmail("abc123@privaterelay.appleid.com"), true);
  assert.equal(isPrivateRelayEmail(" ABC123@PRIVATERELAY.APPLEID.COM "), true);
});

test("does not exclude ordinary or lookalike email domains", () => {
  assert.equal(isPrivateRelayEmail("collector@icloud.com"), false);
  assert.equal(isPrivateRelayEmail("collector@gmail.com"), false);
  assert.equal(isPrivateRelayEmail("collector@exampleprivaterelay.appleid.com"), false);
  assert.equal(isPrivateRelayEmail(null), false);
});
