const test = require("node:test");
const assert = require("node:assert/strict");
const { SENDER_PREHEADER_MAX, senderPreheader } = require("../lib/newsletter-email");

test("Sender preheaders never exceed the provider's 255-character limit", () => {
  assert.equal(SENDER_PREHEADER_MAX, 255);
  assert.equal(senderPreheader({ dek:"A".repeat(300) }).length, 255);
  assert.equal(Array.from(senderPreheader({ dek:"✨".repeat(300) })).length, 255);
});

test("Sender preheaders fall back to the issue summary", () => {
  assert.equal(senderPreheader({ dek:"", summary:"  Collector spotlight preview  " }), "Collector spotlight preview");
});
