const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MAX_UPLOADS, SESSION_TTL_MS, sessionExpiry, sessionIsUsable } = require("../lib/newsletter-submission-session");
const { senderRetryAction } = require("../lib/newsletter-sender-state");
const { normalizeTrainerId, trainerProfileUrl } = require("../lib/newsletter-trainer");
const { socialDetails } = require("../lib/newsletter-social");
const { collectionStoryFields, storyBodyHtml } = require("../lib/newsletter-story");

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

test("collector biographies are not repeated in generated story bodies", () => {
  assert.equal(storyBodyHtml({ summary:"About the collector", bodyHtml:"<p>About the collector</p>" }), "");
  assert.equal(storyBodyHtml({ summary:"About the collector", bodyHtml:"<p>About the collector</p><h2>More context</h2><p>A detail.</p>" }), "<h2>More context</h2><p>A detail.</p>");
  assert.equal(storyBodyHtml({ summary:"About the collector", bodyHtml:"<p>Different editorial introduction.</p>" }), "<p>Different editorial introduction.</p>");
});

test("legacy collection sections move into the structured profile without duplication", () => {
  const issue = {
    summary:"About the collector",
    bodyHtml:"<p>About the collector</p><h2>The collection</h2><p>Kanto through modern.</p><h2>A favorite</h2><p>Pikachu</p><h2>The current chase</h2><p>Mega Gengar</p><h2>The grail</h2><p>Red Cheeks Pikachu</p>"
  };
  assert.deepEqual(collectionStoryFields(issue), { collectionFocus:"Kanto through modern.", favorite:"Pikachu", currentChase:"Mega Gengar", grail:"Red Cheeks Pikachu" });
  assert.equal(storyBodyHtml(issue), "");
});

test("social profiles have friendly labels with a generic fallback", () => {
  assert.deepEqual(socialDetails("https://twitter.com/route25app?ref=email"), { label:"Twitter (X)", displayUrl:"x.com/route25app" });
  assert.deepEqual(socialDetails("https://www.instagram.com/route25app/"), { label:"Instagram", displayUrl:"instagram.com/route25app" });
  assert.deepEqual(socialDetails("https://bsky.app/profile/route25.app"), { label:"Bluesky", displayUrl:"bsky.app/profile/route25.app" });
  assert.deepEqual(socialDetails("https://collectors.example/@route25?source=form"), { label:"Social profile", displayUrl:"collectors.example/@route25" });
});

test("collector spotlight presentation uses fixed subscription and structured editorial fields", () => {
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
  assert.match(publicRenderer, /lightbox-next/);
  assert.match(publicRenderer, /ArrowRight/);
  assert.match(publicRenderer, /is-zoomed/);
  assert.match(publicRenderer, /Zoom out image/);
  assert.match(publicRenderer, /target="_blank" rel="noopener noreferrer sponsored nofollow"/);
  assert.match(publicRenderer, /rel="noopener noreferrer me nofollow"/);
  assert.match(previewPage, /data-story-image/);
  assert.match(previewPage, /lightbox-next/);
  assert.match(previewPage, /ArrowRight/);
  assert.match(previewPage, /is-zoomed/);
  assert.match(previewPage, /Zoom out image/);
  assert.match(previewPage, /target="_blank" rel="noopener noreferrer sponsored nofollow"/);
  assert.match(previewPage, /rel="noopener noreferrer me nofollow"/);
  assert.match(previewPage, /View this trainer on Route 25/);
  assert.match(previewPage, /trainerProfileUrl/);
  assert.match(previewPage, /storyBodyHtml/);
  assert.doesNotMatch(previewPage, /issue\.subscribeUrl/);
});

test("editorial photo uploads are admin-only and retain newsletter image safeguards", () => {
  const adminPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "admin.html"), "utf8");
  const newsletterApi = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter.js"), "utf8");
  const adminBoundary = newsletterApi.indexOf("await requireAdmin(req);");

  assert.match(adminPage, /id="editorPhotos"[^>]+multiple/);
  assert.match(adminPage, /admin-upload-url/);
  assert.match(adminPage, /admin-complete-upload/);
  assert.match(adminPage, /EDITOR_MAX_IMAGES=15/);
  assert.match(adminPage, /EDITOR_MAX_IMAGE_BYTES=10\*1024\*1024/);
  assert.ok(adminBoundary > -1);
  assert.ok(newsletterApi.indexOf('action === "admin-upload-url"') > adminBoundary);
  assert.ok(newsletterApi.indexOf('action === "admin-complete-upload"') > adminBoundary);
  assert.match(newsletterApi, /NEWSLETTER_IMAGE_PATH/);
  assert.match(newsletterApi, /MAX_IMAGE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(newsletterApi, /IMAGE_TYPES = new Set\(\["image\/jpeg", "image\/png", "image\/webp", "image\/heic"\]\)/);
});

test("swapping one submission question preserves every unchanged answer", () => {
  const submissionPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "submit.html"), "utf8");

  assert.match(submissionPage, /function currentQuestionAnswers\(\)/);
  assert.match(submissionPage, /answers\.get\(questionKey\(q,i\)\)/);
  assert.match(submissionPage, /const answers=currentQuestionAnswers\(\);questions\[index\]=data\.questions\[0\];renderQuestions\(answers\)/);
  assert.match(submissionPage, /querySelectorAll\('\[data-swap-question\]'\)\.forEach\(control=>control\.disabled=true\)/);
});

test("editor workflow saves blocked schedules as drafts and explains test delivery", () => {
  const adminPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "admin.html"), "utf8");
  const newsletterApi = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter.js"), "utf8");

  assert.match(adminPage, /Publishing a real issue/);
  assert.match(adminPage, /<strong>Send test<\/strong>/);
  assert.match(adminPage, /Do not select this to test-email a real issue/);
  assert.doesNotMatch(adminPage, />Article HTML</);
  assert.match(adminPage, /name="dek" maxlength="255"/);
  assert.match(adminPage, /id="dekCount"/);
  assert.match(newsletterApi, /issue\.status = "draft"/);
  assert.match(newsletterApi, /schedulingBlocked/);
  assert.match(newsletterApi, /status:issue\.status/);
});

test("structured story text preserves paragraphs across web, preview, and email", () => {
  const adminPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "admin.html"), "utf8");
  const previewPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "issue.html"), "utf8");
  const publicRenderer = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter-page.js"), "utf8");
  const newsletterApi = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter.js"), "utf8");

  assert.match(adminPage, /story-summary/);
  assert.match(adminPage, /textMarkup\(d\.collectionFocus\)/);
  assert.match(previewPage, /textMarkup\(issue\.summary\)/);
  assert.match(previewPage, /textMarkup\(collection\.collectionFocus\)/);
  assert.match(publicRenderer, /textMarkup\(issue\.summary\)/);
  assert.match(newsletterApi, /emailParagraphs\(issue\.summary/);
  assert.match(newsletterApi, /emailParagraphs\(collection\.collectionFocus/);
});

test("newsletter emails use three distinct images in the editorial sequence", () => {
  const adminPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "admin.html"), "utf8");
  const newsletterApi = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter.js"), "utf8");

  assert.match(adminPage, /first three included photos appear in the email/i);
  assert.match(newsletterApi, /const \[hero, storyImage, thirdImage\] = emailImages/);
  assert.match(newsletterApi, /\$\{interview\}\$\{thirdImage \?/);
  assert.match(newsletterApi, /\$\{gear\}/);
  assert.match(newsletterApi, /index < 3/);
  assert.match(newsletterApi, /See \$\{remainingPhotos\} more collection photo/);
  assert.match(newsletterApi, /imageLinkEnd/);
  assert.match(newsletterApi, /href="\$\{html\(photoSectionUrl\)\}" target="_blank"/);
});

test("newsletter email images link to the wider collection section", () => {
  const previewPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "issue.html"), "utf8");
  const publicRenderer = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter-page.js"), "utf8");
  const newsletterApi = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter.js"), "utf8");

  assert.match(newsletterApi, /const photoSectionUrl = `\$\{canonicalUrl\.split\("#"\)\[0\]\}#collection-photos`/);
  assert.match(newsletterApi, /href="\$\{html\(photoSectionUrl\)\}" target="_blank" rel="noopener noreferrer"/);
  assert.match(newsletterApi, /\.r25-pad\{padding-left:10px!important;padding-right:10px!important\}/);
  assert.match(newsletterApi, /\.r25-image-pad\{padding-left:0!important;padding-right:0!important\}/);
  assert.match(newsletterApi, /\.r25-outer,\.r25-shell\{padding-left:0!important;padding-right:0!important\}/);
  assert.match(previewPage, /section id="collection-photos"/);
  assert.match(previewPage, /location\.hash==='\#collection-photos'/);
  assert.match(publicRenderer, /section id="collection-photos"/);
});

test("published collector spotlights use branded same-origin social previews", () => {
  const publicRenderer = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter-page.js"), "utf8");
  const socialRenderer = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter-og.js"), "utf8");
  const socialCanvas = fs.readFileSync(path.join(__dirname, "..", "lib", "newsletter-og-canvas.js"), "utf8");
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));

  assert.match(publicRenderer, /\/api\/newsletter\/og\?slug=/);
  assert.match(publicRenderer, /og:image:width/);
  assert.match(publicRenderer, /twitter:image:alt/);
  assert.match(publicRenderer, /twitter:site/);
  assert.match(publicRenderer, /socialRevision/);
  assert.match(socialRenderer, /issue\.status !== "published"/);
  assert.match(socialRenderer, /issue\.publicVisibility !== true/);
  assert.match(socialRenderer, /approvedPhotoUrl/);
  assert.match(socialRenderer, /brightness: 0\.55, saturation: 0\.45/);
  assert.match(socialCanvas, /rgba\(0,0,0,0\.5\)/);
  assert.match(socialCanvas, /width: "1200px", height: "630px", objectFit: "cover"/);
  assert.match(socialCanvas, /textShadow/);
  assert.match(socialCanvas, /const logo = assets\.logo/);
  assert.match(socialRenderer, /route25-logo-white\.png/);
  assert.doesNotMatch(socialCanvas, /issue\?\.dek|issue\?\.summary/);
  assert.ok(vercel.rewrites.some(rewrite => rewrite.source === "/api/newsletter/og" && rewrite.destination === "/api/newsletter-og.js"));
});

test("story subscription prompts state the Saturday delivery cadence", () => {
  const previewPage = fs.readFileSync(path.join(__dirname, "..", "newsletter", "issue.html"), "utf8");
  const publicRenderer = fs.readFileSync(path.join(__dirname, "..", "api", "newsletter-page.js"), "utf8");

  assert.match(previewPage, /Delivered to your inbox every Saturday/);
  assert.match(publicRenderer, /Delivered to your inbox every Saturday/);
});
