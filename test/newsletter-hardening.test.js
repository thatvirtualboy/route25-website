const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MAX_UPLOADS, SESSION_TTL_MS, sessionExpiry, sessionIsUsable } = require("../lib/newsletter-submission-session");
const { senderRetryAction } = require("../lib/newsletter-sender-state");
const { normalizeTrainerId, trainerProfileUrl } = require("../lib/newsletter-trainer");
const { socialDetails } = require("../lib/newsletter-social");

test("submission sessions expire after 30 minutes and allow at most 15 uploads", () => {
  const now = Date.now();
  assert.equal(MAX_UPLOADS, 15);
  assert.equal(SESSION_TTL_MS, 30 * 60 * 1000);
  assert.equal(sessionExpiry(now).getTime(), now + SESSION_TTL_MS);
  assert.equal(sessionIsUsable({ ipHash:"one", consumed:false, expiresAt:new Date(now + 1000) }, "one", now), true);
  assert.equal(sessionIsUsable({ ipHash:"two", consumed:false, expiresAt:new Date(now + 1000) }, "one", now), false);
  assert.equal(sessionIsUsable({ ipHash:"one", consumed:true, expiresAt:new Date(now + 1000) }, "one", now), false);
  assert.equal(sessionIsUsable({ ipHash:"one", consumed:false, expiresAt:new Date(now - 1) }, "one", now), false);
});

test("Sender retries reconcile sent campaigns and wait for active campaigns", () => {
  assert.equal(senderRetryAction("SENT"), "reconcile-published");
  assert.equal(senderRetryAction("processing"), "wait");
  assert.equal(senderRetryAction("sending"), "wait");
  assert.equal(senderRetryAction("draft"), "send");
  assert.equal(senderRetryAction(""), "send");
});

test("Vercel routes public issues through the server renderer and protects private routes", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
  assert.equal(config.rewrites.find(item => item.source === "/newsletter/:slug")?.destination, "/api/newsletter-page.js?slug=:slug");
  assert.equal(config.rewrites.find(item => item.source === "/sitemap-newsletter.xml")?.destination, "/api/sitemap-newsletter.js");
  assert.ok(config.headers.find(item => item.source === "/(.*)")?.headers.some(header => header.key === "Content-Security-Policy"));
  assert.ok(config.headers.find(item => item.source === "/newsletter/admin")?.headers.some(header => header.key === "X-Robots-Tag"));
  assert.ok(config.headers.find(item => item.source === "/newsletter/preview/(.*)")?.headers.some(header => header.key === "X-Robots-Tag"));
});

test("newsletter sitemap is advertised to crawlers", () => {
  const robots = fs.readFileSync(path.join(__dirname, "..", "robots.txt"), "utf8");
  assert.match(robots, /sitemap-newsletter\.xml/);
});

test("Route 25 Trainer IDs produce safe profile links", () => {
  assert.equal(normalizeTrainerId(" 8dHIaVfOcdg96oKjImpjFYQB1C73 "), "8dHIaVfOcdg96oKjImpjFYQB1C73");
  assert.equal(trainerProfileUrl("8dHIaVfOcdg96oKjImpjFYQB1C73"), "https://route25.app/trainer/8dHIaVfOcdg96oKjImpjFYQB1C73");
  assert.equal(normalizeTrainerId("../../admin"), "");
  assert.equal(trainerProfileUrl(""), "");
});

test("social profiles have friendly labels with a generic fallback", () => {
  assert.deepEqual(socialDetails("https://twitter.com/route25app?ref=email"), { label:"Twitter (X)", displayUrl:"x.com/route25app" });
  assert.deepEqual(socialDetails("https://www.instagram.com/route25app/"), { label:"Instagram", displayUrl:"instagram.com/route25app" });
  assert.deepEqual(socialDetails("https://bsky.app/profile/route25.app"), { label:"Bluesky", displayUrl:"bsky.app/profile/route25.app" });
  assert.deepEqual(socialDetails("https://collectors.example/@route25?source=form"), { label:"Social profile", displayUrl:"collectors.example/@route25" });
});

test("collector story presentation uses fixed subscription and structured editorial fields", () => {
  const adminPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "admin.html"), "utf8");
  const submissionPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "submit.html"), "utf8");
  const previewPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "issue.html"), "utf8");
  const publicRenderer = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter-page.js"), "utf8");
  const newsletterApi = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter.js"), "utf8");

  assert.doesNotMatch(adminPage, /name="subscribeUrl"/);
  assert.match(submissionPage, /What makes your collection interesting\?/);
  assert.match(newsletterApi, /collectionFocus:text\(b\.collectionFocus,1000\)/);
  assert.match(newsletterApi, /socialDetails\(socialUrl\)/);
  assert.match(newsletterApi, /Collection profile/);
  assert.match(newsletterApi, /Collector’s corner/);
  assert.match(publicRenderer, /href="\/newsletter\/subscribe"/);
  assert.match(publicRenderer, /data-story-image/);
  assert.match(publicRenderer, /storyLightbox/);
  assert.match(previewPage, /data-story-image/);
  assert.doesNotMatch(previewPage, /issue\.subscribeUrl/);
});
