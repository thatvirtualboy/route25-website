const test = require("node:test");
const assert = require("node:assert/strict");
const { SENDER_PREHEADER_MAX, senderSubject, senderPreheader } = require("../lib/newsletter-email");

test("Sender subjects include the zero-padded saved issue number", () => {
  assert.equal(senderSubject({ issueNumber:2, title:"Meet Fernando Silva" }), "002 - Meet Fernando Silva");
  assert.equal(senderSubject({ issueNumber:27, title:"  Meet Ryan  " }), "027 - Meet Ryan");
});

test("Sender subjects keep the plain title when an issue has no real number", () => {
  assert.equal(senderSubject({ issueNumber:null, title:"Formatting preview" }), "Formatting preview");
  assert.equal(senderSubject({ issueNumber:0, title:"Test issue" }), "Test issue");
});

test("Sender preheaders never exceed the provider's 255-character limit", () => {
  assert.equal(SENDER_PREHEADER_MAX, 255);
  assert.equal(senderPreheader({ dek:"A".repeat(300) }).length, 255);
  assert.equal(Array.from(senderPreheader({ dek:"✨".repeat(300) })).length, 255);
});

test("Sender preheaders fall back to the issue summary", () => {
  assert.equal(senderPreheader({ dek:"", summary:"  Collector spotlight preview  " }), "Collector spotlight preview");
});
