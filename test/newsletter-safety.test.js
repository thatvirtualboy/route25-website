const test = require("node:test");
const assert = require("node:assert/strict");
const { isExactPublicationSlot, isFuturePublicationSlot, isCurrentPublicationWindow, publicationPreflight } = require("../lib/newsletter-safety");

test("recognizes Saturday 7 AM Mountain in daylight time", () => {
  assert.equal(isExactPublicationSlot(new Date("2026-07-18T13:00:00Z")), true);
  assert.equal(isExactPublicationSlot(new Date("2026-07-18T14:00:00Z")), false);
});

test("recognizes Saturday 7 AM Mountain in standard time", () => {
  assert.equal(isExactPublicationSlot(new Date("2026-12-19T14:00:00Z")), true);
});

test("requires scheduling dates to be future Saturday publication slots", () => {
  const now = new Date("2026-07-13T18:00:00Z");
  assert.equal(isFuturePublicationSlot(new Date("2026-07-18T13:00:00Z"), now), true);
  assert.equal(isFuturePublicationSlot(new Date("2026-07-11T13:00:00Z"), now), false);
  assert.equal(isFuturePublicationSlot(null, now), false);
});

test("does not roll a missed issue into a later Saturday", () => {
  assert.equal(isCurrentPublicationWindow(new Date("2026-07-11T13:00:00Z"), new Date("2026-07-18T13:00:00Z")), false);
  assert.equal(isCurrentPublicationWindow(new Date("2026-07-18T13:00:00Z"), new Date("2026-07-18T13:20:00Z")), true);
});

test("preflight requires editorial content and a test send", () => {
  const result = publicationPreflight({ issueNumber: 1, title: "Story", trainerName: "Trainer", summary: "Summary", images: [{ url: "https://example.com/image.jpg" }], interviewAnswers: [{ answer: "A" }], isTest: false }, { senderConfigured: true, liveGroupConfigured: true, liveSendEnabled: false });
  assert.equal(result.readyToSchedule, false);
  assert.equal(result.checks.find(check => check.key === "test-email").ok, false);
  assert.equal(result.checks.some(check => check.key === "article"), false);
  assert.equal(result.readyToPublish, false);
});

test("a complete issue can be scheduled while live delivery remains disabled", () => {
  const issue = { issueNumber: 1, title: "Story", trainerName: "Trainer", summary: "Summary", images: [{ objectPath: "newsletter/one.jpg" }, { objectPath: "newsletter/two.jpg" }, { objectPath: "newsletter/three.jpg" }], interviewAnswers: [{ answer: "A" }], lastTestEmailAt: new Date().toISOString(), isTest: false };
  const result = publicationPreflight(issue, { senderConfigured: true, liveGroupConfigured: true, liveSendEnabled: false });
  assert.equal(result.readyToSchedule, true);
  assert.equal(result.readyToPublish, false);
});

test("real issues require three included email images", () => {
  const issue = { issueNumber: 1, title: "Story", trainerName: "Trainer", summary: "Summary", images: [{ objectPath: "newsletter/one.jpg" }, { objectPath: "newsletter/two.jpg" }], interviewAnswers: [{ answer: "A" }], lastTestEmailAt: new Date().toISOString(), isTest: false };
  const result = publicationPreflight(issue, { senderConfigured: true, liveGroupConfigured: true, liveSendEnabled: true });
  assert.equal(result.readyToSchedule, false);
  assert.equal(result.checks.find(check => check.key === "email-images").ok, false);
});

test("test issues can never pass scheduling preflight", () => {
  const issue = { issueNumber: 1, title: "Story", trainerName: "Trainer", summary: "Summary", bodyHtml: "<p>Body</p>", images: [{ url: "https://example.com/image.jpg" }], interviewAnswers: [{ answer: "A" }], lastTestEmailAt: new Date().toISOString(), isTest: true };
  const result = publicationPreflight(issue, { senderConfigured: true, liveGroupConfigured: true, liveSendEnabled: true });
  assert.equal(result.readyToSchedule, false);
  assert.equal(result.readyToPublish, false);
  assert.equal(result.checks.find(check => check.key === "test-hidden").ok, true);
  assert.equal(result.checks.some(check => check.key === "not-test"), false);
});

test("real issues require a positive issue number", () => {
  const issue = { title: "Story", trainerName: "Trainer", summary: "Summary", bodyHtml: "<p>Body</p>", images: [{ url: "https://example.com/image.jpg" }], interviewAnswers: [{ answer: "A" }], lastTestEmailAt: new Date().toISOString(), isTest: false };
  const result = publicationPreflight(issue, { senderConfigured: true, liveGroupConfigured: true, liveSendEnabled: true });
  assert.equal(result.readyToSchedule, false);
  assert.equal(result.checks.find(check => check.key === "issue-number").ok, false);
});
