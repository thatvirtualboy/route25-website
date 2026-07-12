const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MAX_UPLOADS, SESSION_TTL_MS, sessionExpiry, sessionIsUsable } = require("../lib/newsletter-submission-session");
const { senderRetryAction } = require("../lib/newsletter-sender-state");

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
