const test = require("node:test");
const assert = require("node:assert/strict");
const { isExactPublicationSlot, isCurrentPublicationWindow, publicationPreflight } = require("../lib/newsletter-safety");

test("recognizes Saturday 7 AM Mountain in daylight time", () => {
  assert.equal(isExactPublicationSlot(new Date("2026-07-18T13:00:00Z")), true);
  assert.equal(isExactPublicationSlot(new Date("2026-07-18T14:00:00Z")), false);
});

test("recognizes Saturday 7 AM Mountain in standard time", () => {
  assert.equal(isExactPublicationSlot(new Date("2026-12-19T14:00:00Z")), true);
});

test("does not roll a missed issue into a later Saturday", () => {
  assert.equal(isCurrentPublicationWindow(new Date("2026-07-11T13:00:00Z"), new Date("2026-07-18T13:00:00Z")), false);
  assert.equal(isCurrentPublicationWindow(new Date("2026-07-18T13:00:00Z"), new Date("2026-07-18T13:20:00Z")), true);
});

test("preflight requires editorial content and a test send", () => {
  const result = publicationPreflight({ title: "Story", trainerName: "Trainer", summary: "Summary", bodyHtml: "<p>Body</p>", images: [{ url: "https://example.com/image.jpg" }], interviewAnswers: [{ answer: "A" }], isTest: false }, { senderConfigured: true, liveGroupConfigured: true, liveSendEnabled: false });
  assert.equal(result.readyToSchedule, false);
  assert.equal(result.checks.find(check => check.key === "test-email").ok, false);
  assert.equal(result.readyToPublish, false);
});

test("a complete issue can be scheduled while live delivery remains disabled", () => {
  const issue = { title: "Story", trainerName: "Trainer", summary: "Summary", bodyHtml: "<p>Body</p>", images: [{ objectPath: "newsletter/photo.jpg" }], interviewAnswers: [{ answer: "A" }], lastTestEmailAt: new Date().toISOString(), isTest: false };
  const result = publicationPreflight(issue, { senderConfigured: true, liveGroupConfigured: true, liveSendEnabled: false });
  assert.equal(result.readyToSchedule, true);
  assert.equal(result.readyToPublish, false);
});

test("test issues can never pass scheduling preflight", () => {
  const issue = { title: "Story", trainerName: "Trainer", summary: "Summary", bodyHtml: "<p>Body</p>", images: [{ url: "https://example.com/image.jpg" }], interviewAnswers: [{ answer: "A" }], lastTestEmailAt: new Date().toISOString(), isTest: true };
  const result = publicationPreflight(issue, { senderConfigured: true, liveGroupConfigured: true, liveSendEnabled: true });
  assert.equal(result.readyToSchedule, false);
  assert.equal(result.readyToPublish, false);
});
