const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { isWeeklyPublicationSlot, isExactPublicationSlot, isCurrentPublicationWindow, publicationPreflight } = require("../lib/newsletter-safety");
const { MAX_UPLOADS, sessionId, sessionExpiry, sessionIsUsable } = require("../lib/newsletter-submission-session");
const { senderRetryAction } = require("../lib/newsletter-sender-state");
const { normalizeTrainerId, trainerProfileUrl } = require("../lib/newsletter-trainer");

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  admin.initializeApp({
    credential: raw ? admin.credential.cert(JSON.parse(raw)) : admin.credential.applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = process.env.FIRESTORE_DATABASE_ID ? getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID) : getFirestore(admin.app());
const bucket = admin.storage().bucket();
const MAX_IMAGES = 15;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const STATUSES = new Set(["submitted", "reviewing", "selected", "draft", "scheduled", "published", "declined"]);
const AFFILIATES = new Set(["amazon", "ebay", "tcgplayer", "direct"]);
const PRODUCT_CATEGORIES = new Set(["gear", "card"]);
const SENDER_API_BASE = "https://api.sender.net/v2";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
let uploadCorsReady = null;
const DEFAULT_QUESTIONS = [
  ["origin", "What brought you into Pokémon collecting?", "story"],
  ["never-sell", "Which card would you never sell, and why?", "cards"],
  ["overlooked", "Which card do you think other collectors overlook?", "cards"],
  ["chase", "What are you chasing right now?", "cards"],
  ["grail", "With an unlimited budget, what single card would you choose?", "cards"],
  ["regret", "What collecting decision taught you the most?", "story"],
  ["proudest", "Which part of your collection are you proudest of?", "story"],
  ["ritual", "Do you have a collecting ritual or habit?", "personal"],
  ["community", "Who do you collect with, or who shaped your collection?", "community"],
  ["display", "How do you organize or display your collection?", "gear"],
  ["starter-advice", "What would you tell someone starting their first binder?", "community"],
  ["under-25", "What is your favorite pickup under $25?", "cards"],
  ["era", "Which Pokémon era feels most like home to you?", "personal"],
  ["goal", "What would make your collection feel complete?", "story"],
  ["gear", "Which piece of collecting gear has earned your trust?", "gear"],
  ["first-pack", "What do you remember about the first Pokémon pack you opened?", "story"],
  ["best-trade", "What is the most memorable trade you have ever made?", "community"],
  ["artwork", "Which card artwork would you hang on your wall as a print?", "cards"],
  ["changed-mind", "Which Pokémon or card changed your mind after you saw it in person?", "cards"],
  ["collecting-rule", "What personal rule helps you enjoy collecting without overdoing it?", "personal"],
  ["shop", "Is there a local card shop or community space that matters to your story?", "community"],
  ["display-choice", "How do you decide what gets displayed and what stays in a binder?", "gear"],
  ["surprise-set", "Which set surprised you most, for better or worse?", "cards"],
  ["one-page", "If you could show someone one binder page, which page would it be?", "story"],
  ["next-chapter", "What is the next chapter of your collection?", "story"]
];

function json(res, status, body) {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}
function text(v, max = 5000) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }
function list(v, max = 20) { return Array.isArray(v) ? v.slice(0, max).map(x => text(x, 500)).filter(Boolean) : []; }
function safeSlug(v) { return text(v, 100).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function isPublicIssue(issue) {
  if (issue?.isTest === true || issue?.publicVisibility === false) return false;
  if (issue?.publicVisibility === true) return true;
  return !/^test(?:\b|-)/i.test(text(issue?.trainerName || issue?.slug || issue?.title, 200));
}
function html(v) { return String(v || "").replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function markdownInline(v) {
  return html(v)
    .replace(/\[(https:\/\/[^\s\]]+)\]\(([^)]+)\)/g, '<a href="$1" style="color:#087bb5;font-weight:bold">$2</a>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#087bb5;font-weight:bold">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
}
function markdownEmail(v) {
  const source = text(v, 10000).replace(/\r\n?/g, "\n");
  if (!source) return "";
  return source.split(/\n{2,}/).map(block => block.trim()).filter(Boolean).map(block => {
    const lines = block.split("\n");
    if (lines.every(line => /^[-*]\s+/.test(line))) return `<ul style="margin:0 0 16px;padding-left:22px">${lines.map(line => `<li style="margin:5px 0">${markdownInline(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    if (lines.every(line => /^\d+\.\s+/.test(line))) return `<ol style="margin:0 0 16px;padding-left:22px">${lines.map(line => `<li style="margin:5px 0">${markdownInline(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    return `<p style="margin:0 0 16px">${lines.map(markdownInline).join("<br>")}</p>`;
  }).join("");
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers["x-forwarded-host"] || req.headers.host); } catch { return false; }
}
function requestIp(req) {
  return text(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0], 100);
}
function requestIpHash(req) {
  const secret = text(process.env.NEWSLETTER_SESSION_SECRET || process.env.TURNSTILE_SECRET_KEY, 500);
  return crypto.createHmac("sha256", secret || "route25-newsletter-local").update(requestIp(req)).digest("hex").slice(0, 32);
}
function turnstileConfigured() {
  return Boolean(text(process.env.TURNSTILE_SITE_KEY, 500) && text(process.env.TURNSTILE_SECRET_KEY, 500));
}
async function checkRateLimit(req, scope, limit, windowMs) {
  const ipHash = requestIpHash(req);
  const ref = db.collection("newsletterRateLimits").doc(`${scope}-${ipHash}`), now = Date.now();
  const allowed = await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref), data = snap.exists ? snap.data() : {}, resetAt = Number(data.resetAt || 0);
    const count = resetAt > now ? Number(data.count || 0) : 0;
    if (count >= limit) return false;
    transaction.set(ref, { scope, ipHash, count: count + 1, resetAt: resetAt > now ? resetAt : now + windowMs, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
  if (!allowed) throw Object.assign(new Error("Too many attempts. Please wait and try again."), { status: 429 });
  return ipHash;
}
async function verifyTurnstile(req, token, action) {
  if (!turnstileConfigured()) return { success: true, bypassed: true };
  const response = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: text(process.env.TURNSTILE_SECRET_KEY, 500), response: text(token, 2048), remoteip: requestIp(req), idempotency_key: crypto.randomUUID() }) });
  const result = await response.json();
  const expectedHost = text(process.env.TURNSTILE_EXPECTED_HOSTNAME || "route25.app", 255).toLowerCase();
  const hostnameMismatch = result.hostname && expectedHost && result.hostname.toLowerCase() !== expectedHost && !["localhost", "127.0.0.1"].includes(result.hostname.toLowerCase());
  if (!response.ok || !result.success || (result.action && result.action !== action) || hostnameMismatch) throw Object.assign(new Error("Human verification failed or expired. Please try again."), { status: 403 });
  return result;
}
function sessionRef(token) {
  const value = text(token, 200);
  if (!/^[a-f0-9-]{36}$/i.test(value)) return null;
  return db.collection("newsletterSubmissionSessions").doc(crypto.createHash("sha256").update(value).digest("hex"));
}
async function createSubmissionSession(req, ipHash) {
  if (!turnstileConfigured()) return "turnstile-not-configured";
  const token = sessionId(), ref = sessionRef(token);
  await ref.create({ ipHash, uploadCount: 0, consumed: false, expiresAt: admin.firestore.Timestamp.fromDate(sessionExpiry()), createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return token;
}
async function authorizeSessionUpload(req, token) {
  if (!turnstileConfigured()) return true;
  const ref = sessionRef(token);
  if (!ref) return false;
  return db.runTransaction(async transaction => {
    const snap = await transaction.get(ref), data = snap.exists ? snap.data() : null;
    if (!sessionIsUsable(data, requestIpHash(req)) || Number(data.uploadCount || 0) >= MAX_UPLOADS) return false;
    transaction.update(ref, { uploadCount: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}
async function consumeSubmissionSession(req, token) {
  if (!turnstileConfigured()) return true;
  const ref = sessionRef(token);
  if (!ref) return false;
  return db.runTransaction(async transaction => {
    const snap = await transaction.get(ref), data = snap.exists ? snap.data() : null;
    if (!sessionIsUsable(data, requestIpHash(req))) return false;
    transaction.update(ref, { consumed: true, consumedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}
async function requireAdmin(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Sign in required"), { status: 401 });
  const user = await admin.auth().verifyIdToken(token);
  const uids = (process.env.NEWSLETTER_ADMIN_UIDS || "").split(",").map(x => x.trim()).filter(Boolean);
  const emails = (process.env.NEWSLETTER_ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!uids.includes(user.uid) && !emails.includes((user.email || "").toLowerCase())) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return user;
}
function normalizeProducts(v) {
  return Array.isArray(v) ? v.slice(0, 20).map(p => ({
    name: text(p?.name, 200), type: AFFILIATES.has(p?.type) ? p.type : "direct",
    category: PRODUCT_CATEGORIES.has(p?.category) ? p.category : "gear",
    url: /^https:\/\//.test(text(p?.url, 2000)) ? text(p.url, 2000) : "",
    note: text(p?.note, 500)
  })).filter(p => p.name) : [];
}
function normalizeAnswers(v) {
  return Array.isArray(v) ? v.slice(0, 10).map(a => ({ questionId: text(a?.questionId, 100), question: text(a?.question, 500), answer: text(a?.answer, 5000) })).filter(a => a.question && a.answer) : [];
}
function normalizeSocialUrl(v) {
  const url = text(v, 2000);
  return /^https:\/\//i.test(url) ? url : "";
}
function socialLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "x.com" || host === "twitter.com") return "X";
    if (host.includes("instagram.com")) return "Instagram";
    if (host.includes("youtube.com") || host === "youtu.be") return "YouTube";
    if (host.includes("tiktok.com")) return "TikTok";
    if (host.includes("threads.net")) return "Threads";
    return host;
  } catch { return "Social"; }
}
async function normalizeIssueImages(v, publish) {
  if (!Array.isArray(v)) return [];
  const images = v.slice(0, MAX_IMAGES).map(image => ({
    objectPath: text(image?.objectPath, 500),
    url: /^https:\/\//.test(text(image?.url, 2000)) ? text(image.url, 2000) : "",
    alt: text(image?.alt, 300),
    caption: text(image?.caption, 500)
  })).filter(image => image.objectPath || image.url);
  if (!publish) return images;
  return Promise.all(images.map(async image => {
    if (!image.objectPath) return image;
    if (!/^newsletter\/submissions\/[0-9-]+\/[a-f0-9-]+\.(jpg|png|webp|heic)$/.test(image.objectPath)) throw Object.assign(new Error("Invalid published image reference"), { status: 400 });
    const file = bucket.file(image.objectPath);
    const [metadata] = await file.getMetadata();
    const custom = metadata.metadata || {};
    const token = custom.firebaseStorageDownloadTokens || crypto.randomUUID();
    if (!custom.firebaseStorageDownloadTokens) await file.setMetadata({ metadata: { ...custom, firebaseStorageDownloadTokens: token } });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(image.objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
    return { ...image, url };
  }));
}
async function emailImageVariant(image, role) {
  if (!image?.objectPath) return image?.url || "";
  const dimensions = role === "hero" ? { width: 1200, height: 800 } : { width: 900, height: 675 };
  const key = crypto.createHash("sha256").update(`${image.objectPath}:${role}:v1`).digest("hex").slice(0, 32);
  const outputPath = `newsletter/derived/${key}-${dimensions.width}x${dimensions.height}.jpg`;
  const output = bucket.file(outputPath);
  try {
    const [exists] = await output.exists();
    if (!exists) {
      const [source] = await bucket.file(image.objectPath).download();
      const rendered = await sharp(source).rotate().resize(dimensions.width, dimensions.height, { fit: "cover", position: sharp.strategy.attention }).jpeg({ quality: 84, progressive: true }).toBuffer();
      await output.save(rendered, { resumable: false, contentType: "image/jpeg", metadata: { cacheControl: "public,max-age=31536000,immutable", metadata: { firebaseStorageDownloadTokens: crypto.randomUUID(), sourceObject: image.objectPath, role } } });
    }
    const [metadata] = await output.getMetadata();
    const token = metadata.metadata?.firebaseStorageDownloadTokens;
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(outputPath)}?alt=media&token=${encodeURIComponent(token)}`;
  } catch (error) {
    console.error("Newsletter image variant failed", { objectPath: image.objectPath, role, message: error.message });
    return image.url || "";
  }
}
function docData(doc) {
  const d = doc.data(), iso = value => value?.toDate?.()?.toISOString?.() || value;
  return { id: doc.id, ...d, createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt), publishedAt: iso(d.publishedAt), publishAt: iso(d.publishAt), lastTestEmailAt: iso(d.lastTestEmailAt), emailSentAt: iso(d.emailSentAt), emailFailedAt: iso(d.emailFailedAt), emailSkippedAt: iso(d.emailSkippedAt) };
}
function languageFlags(values) {
  const source = values.join(" ").toLowerCase();
  const checks = [
    ["profanity", /\b(fuck|shit|bitch|asshole)\b/i],
    ["threatening-language", /\b(kill|hurt|attack)\s+(you|them|him|her)\b/i],
    ["sexual-language", /\b(porn|nudes?|sexually explicit)\b/i]
  ];
  return checks.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}
async function notifyNewSubmission(submission) {
  const webhook = text(process.env.NEWSLETTER_SLACK_WEBHOOK_URL, 2000);
  if (!/^https:\/\/hooks\.slack\.com\//.test(webhook)) return false;
  const adminUrl = `${process.env.PUBLIC_SITE_URL || "https://route25.app"}/newsletter/admin`;
  const lines = [`*New Collector Stories submission*`, `*${submission.name}* — ${submission.collectionFocus}`, `${submission.images.length} photo${submission.images.length === 1 ? "" : "s"}`, submission.currentChase ? `Current chase: ${submission.currentChase}` : "", `<${adminUrl}|Review submission>`].filter(Boolean);
  const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: lines.join("\n") }) });
  if (!response.ok) throw new Error(`Slack notification failed (${response.status})`);
  return true;
}
async function notifyEditorial(textLines) {
  const webhook = text(process.env.NEWSLETTER_SLACK_WEBHOOK_URL, 2000);
  if (!/^https:\/\/hooks\.slack\.com\//.test(webhook)) return false;
  const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: textLines.filter(Boolean).join("\n") }) });
  if (!response.ok) throw new Error(`Slack notification failed (${response.status})`);
  return true;
}
function senderConfigured() {
  return Boolean(text(process.env.SENDER_API_TOKEN, 2000) && text(process.env.SENDER_FROM_NAME, 200) && /^\S+@\S+\.\S+$/.test(text(process.env.SENDER_FROM_EMAIL, 254)));
}
function deliveryConfig() {
  return {
    senderConfigured: senderConfigured(),
    liveGroupConfigured: Boolean(text(process.env.SENDER_GROUP_ID, 200)),
    liveSendEnabled: /^true$/i.test(text(process.env.NEWSLETTER_LIVE_SEND_ENABLED, 10))
  };
}
function issueDisplayDate(issue, fallback = new Date()) {
  const raw = issue?.publishAt?.toDate?.() || issue?.publishedAt?.toDate?.() || issue?.publishAt || issue?.publishedAt || fallback;
  const date = new Date(raw);
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "long", day: "numeric", year: "numeric" }).format(Number.isFinite(date.getTime()) ? date : fallback);
}
async function senderRequest(path, options = {}) {
  const token = text(process.env.SENDER_API_TOKEN, 2000);
  if (!token) throw Object.assign(new Error("Sender is not configured"), { status: 503 });
  const response = await fetch(`${SENDER_API_BASE}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json", ...(options.headers || {}) }
  });
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
  if (!response.ok) {
    console.error("Sender API error", {
      endpoint: path,
      method: options.method || "GET",
      status: response.status,
      response: raw.slice(0, 2000),
      requestId: response.headers.get("x-request-id") || response.headers.get("x-correlation-id") || response.headers.get("cf-ray") || "",
      contentType: response.headers.get("content-type") || "",
      timestamp: new Date().toISOString()
    });
    const providerMessage = Array.isArray(body?.message) ? body.message.map(item => `${text(item?.title, 100)}: ${text(item?.details, 400)}`).filter(Boolean).join("; ") : body?.message;
    const detail = text(providerMessage || body?.error || body?.errors?.[0]?.message, 500) || `HTTP ${response.status}`;
    throw Object.assign(new Error(`Sender request failed: ${detail}`), { status: response.status >= 500 ? 502 : 400, providerStatus: response.status });
  }
  return body;
}
async function syncSubscriberToSender(email) {
  const groupId = text(process.env.SENDER_GROUP_ID, 200);
  if (!senderConfigured() || !groupId) throw Object.assign(new Error("Sender subscriber sync is not configured"), { status: 503 });
  try {
    const created = await senderRequest("/subscribers", { method: "POST", body: JSON.stringify({ email, groups: [groupId], trigger_automation: false }) });
    return { subscriberId: text(created?.data?.id, 200), groupId };
  } catch (error) {
    if (![400, 409, 422].includes(error.providerStatus)) throw error;
    await senderRequest(`/subscribers/groups/${encodeURIComponent(groupId)}`, { method: "POST", body: JSON.stringify({ subscribers: [email], trigger_automation: false }) });
    return { subscriberId: "", groupId };
  }
}
function buildEmail(issue) {
  const site = (process.env.PUBLIC_SITE_URL || "https://route25.app").replace(/\/$/, "");
  const canonicalUrl = issue.emailCanonicalUrl || `${site}/newsletter/${issue.slug}`;
  const hero = (issue.images || []).find(image => /^https:\/\//.test(image.emailUrl || image.url || ""));
  const storyImage = (issue.images || []).slice(1).find(image => /^https:\/\//.test(image.emailUrl || image.url || ""));
  const remainingPhotos = Math.max(0, (issue.images || []).length - (storyImage ? 2 : 1));
  const products = (issue.products || []).filter(product => product.name).slice(0, 8);
  const productGroup = (title, items) => items.length ? `<h3 style="margin:20px 0 8px;color:#101828;font-size:17px">${title}</h3>${items.map(product => `<p style="margin:10px 0;color:#475467;font-size:15px;line-height:1.5"><strong style="color:#101828">${html(product.name)}</strong>${product.note ? ` — ${html(product.note)}` : ""}${product.url ? ` <a href="${html(product.url)}" style="color:#087bb5;font-weight:bold">View</a>` : ""}</p>`).join("")}` : "";
  const gear = products.length ? `<div style="margin:30px 0 0;padding:24px;background:#f3f6fa;border:1px solid #e3e8ef;border-radius:16px"><h2 style="margin:0;color:#101828;font-size:22px">Collector’s corner</h2>${productGroup("Cards mentioned", products.filter(product => product.category === "card"))}${productGroup("Gear used", products.filter(product => product.category !== "card"))}</div>` : "";
  const interview = (issue.interviewAnswers || []).length ? `<div style="margin-top:34px"><p style="margin:0 0 8px;color:#168fc8;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Five questions</p>${issue.interviewAnswers.map(answer => `<h3 style="margin:22px 0 7px;color:#101828;font-size:18px;line-height:1.35">${html(answer.question)}</h3><p style="margin:0;color:#475467;font-size:16px;line-height:1.7">${html(answer.answer)}</p>`).join("")}</div>` : "";
  const socialUrl = normalizeSocialUrl(issue.socialUrl || issue.socialLinks?.[0]);
  const socials = socialUrl ? `<p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:14px"><a href="${html(socialUrl)}" style="color:#087bb5;font-weight:bold;text-decoration:none">${html(socialLabel(socialUrl))}</a></p>` : "";
  const trainerUrl = trainerProfileUrl(issue.trainerId, site);
  const trainerCta = trainerUrl ? `<p style="margin:18px 0 0"><a href="${html(trainerUrl)}" style="display:inline-block;background:#202737;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;padding:11px 17px;border-radius:999px">View this trainer on Route 25</a></p>` : "";
  const issueNumber = Number.isInteger(Number(issue.issueNumber)) && Number(issue.issueNumber) > 0 ? `#${String(Number(issue.issueNumber)).padStart(3, "0")}` : "Preview";
  const displayDate = issueDisplayDate(issue);
  const masthead = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef2f6"><tr><td align="center" style="padding:24px 8px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:720px"><tr><td align="right" style="padding:0 4px 12px;color:#475467;font-family:Arial,sans-serif;font-size:14px">${html(displayDate)}</td></tr><tr><td style="padding:22px 28px;background:#07111f;color:#ffffff;font-family:Arial,sans-serif;border-radius:20px;overflow:hidden"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="color:#ffffff;font-size:24px;font-weight:bold">Route 25</td><td align="right" style="color:#aab4c3;font-family:Courier New,monospace;font-size:12px;letter-spacing:1.5px;text-transform:uppercase">Issue ${html(issueNumber)} · ${html(issue.trainerName || "Collector Stories")}</td></tr></table></td></tr></table></td></tr></table>`;
  const noteContent = issue.emailNoteMarkdown ? markdownEmail(issue.emailNoteMarkdown) : issue.emailNoteHtml;
  const editorNote = noteContent ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef2f6"><tr><td align="center" style="padding:18px 8px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:720px;background:#ffffff;border:1px solid #dde3ea;border-radius:20px;overflow:hidden"><tr><td class="r25-pad" style="padding:28px 32px;color:#344054;font-family:Arial,sans-serif;font-size:17px;line-height:1.7"><p style="margin:0 0 14px;color:#168fc8;font-family:Courier New,monospace;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">From the editor</p>${noteContent}</td></tr></table></td></tr></table>` : "";
  const content = `<style>@media screen and (max-width:600px){.r25-shell{padding:8px 0!important}.r25-card{border-left:0!important;border-right:0!important;border-radius:0!important}.r25-pad{padding-left:20px!important;padding-right:20px!important}.r25-image-pad{padding-left:12px!important;padding-right:12px!important}.r25-title{font-size:34px!important}}</style><div style="display:none;max-height:0;overflow:hidden">${html(issue.dek || issue.summary).slice(0, 180)}</div>${masthead}${editorNote}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef2f6"><tr><td class="r25-shell" align="center" style="padding:18px 8px"><table class="r25-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:720px;background:#ffffff;border:1px solid #dde3ea;border-radius:20px;overflow:hidden"><tr><td class="r25-pad" style="padding:30px 36px 18px"><p style="margin:0 0 8px;color:#168fc8;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase">Route 25 · Issue ${html(issueNumber)}</p><h1 class="r25-title" style="margin:0;color:#101828;font-family:Arial,sans-serif;font-size:40px;line-height:1.08;letter-spacing:-1.2px">${html(issue.title)}</h1><p style="margin:18px 0 0;color:#475467;font-family:Arial,sans-serif;font-size:18px;line-height:1.65">${html(issue.summary)}</p>${socials}${trainerCta}</td></tr>${hero ? `<tr><td class="r25-image-pad" style="padding:10px 20px 24px"><img src="${html(hero.emailUrl || hero.url)}" width="680" alt="${html(hero.alt || issue.title)}" style="display:block;width:100%;max-width:680px;height:auto;border-radius:16px"></td></tr>` : ""}<tr><td class="r25-pad" style="padding:4px 36px 34px;color:#344054;font-family:Arial,sans-serif;font-size:16px;line-height:1.7"><div style="color:#344054">${issue.bodyHtml || `<p>${html(issue.summary)}</p>`}</div>${storyImage ? `<img src="${html(storyImage.emailUrl || storyImage.url)}" width="648" alt="${html(storyImage.alt || `${issue.trainerName} collection`)}" style="display:block;width:100%;max-width:648px;height:auto;border-radius:14px;margin:30px 0">` : ""}${interview}${gear}<div style="margin:34px 0 10px;padding:24px;text-align:center;background:#07111f;border-radius:16px"><p style="margin:0 0 16px;color:#d7e1eb;font-size:15px;line-height:1.55">${remainingPhotos ? `${remainingPhotos} more collection photo${remainingPhotos === 1 ? "" : "s"} and the rest of the story are waiting on Route 25.` : "Continue reading the full collector story on Route 25."}</p><a href="${html(canonicalUrl)}" style="display:inline-block;background:#28a9ea;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 20px;border-radius:999px">See the full collection tour</a></div><p style="margin:28px 0 0;color:#667085;font-size:12px;line-height:1.55;text-align:center">Some links may be affiliate links. Purchases support Route 25 at no additional cost to you.</p><p style="margin:10px 0 0;text-align:center;font-size:11px"><a href="{{unsubscribe_link}}" style="color:#667085">{{unsubscribe_text}}</a></p></td></tr></table></td></tr></table>`;
  return { subject: issue.title, preheader: issue.dek || String(issue.summary || "").slice(0, 140), content, canonicalUrl };
}
async function createSenderCampaign(issue, groupId, label) {
  if (!senderConfigured() || !groupId) throw Object.assign(new Error("Sender campaign delivery is not configured"), { status: 503 });
  const images = await Promise.all((issue.images || []).map(async (image, index) => index < 2 ? { ...image, emailUrl: await emailImageVariant(image, index === 0 ? "hero" : "story") } : image));
  const email = buildEmail({ ...issue, images });
  const replyTo = text(process.env.SENDER_REPLY_TO, 254) || text(process.env.SENDER_FROM_EMAIL, 254);
  const result = await senderRequest("/campaigns", { method: "POST", body: JSON.stringify({
    title: `${label}: ${issue.title}`, subject: email.subject, from: text(process.env.SENDER_FROM_NAME, 200), reply_to: replyTo,
    preheader: email.preheader, content_type: "html", groups: [groupId], content: email.content, google_analytics: 1
  }) });
  const campaignId = text(result?.data?.id, 200);
  if (!campaignId) throw Object.assign(new Error("Sender did not return a campaign ID"), { status: 502 });
  return { campaignId, email };
}
async function sendSenderCampaign(campaignId) {
  return senderRequest(`/campaigns/${encodeURIComponent(campaignId)}/send`, { method: "POST" });
}
async function senderCampaignStatus(campaignId) {
  const result = await senderRequest(`/campaigns/${encodeURIComponent(campaignId)}`);
  return text(result?.data?.status || result?.status, 50).toLowerCase();
}
async function deliverAndPublishIssue(ref, source) {
  const config = deliveryConfig();
  const images = await normalizeIssueImages(source.images, true);
  const issue = { ...source, images, status: "scheduled" };
  const preflight = publicationPreflight(issue, config);
  if (!preflight.readyToPublish) {
    const missing = preflight.checks.filter(check => !check.ok).map(check => check.label);
    await ref.set({ emailStatus: config.liveSendEnabled ? "preflight-blocked" : "live-disabled", preflightMissing: missing, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    throw Object.assign(new Error(`Publication blocked: ${missing.join(", ")}`), { status: 409, preflight });
  }
  const attemptId = crypto.randomUUID();
  const claimed = await db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    if (!current.exists || current.data().status !== "scheduled" || ["preparing", "sending"].includes(current.data().emailStatus)) return false;
    transaction.update(ref, { emailStatus: "preparing", publicationAttemptId: attemptId, publicationAttemptAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) throw Object.assign(new Error("This issue is already being delivered or is no longer scheduled."), { status: 409 });
  try {
    let campaignId = text(source.senderCampaignId, 200);
    if (!campaignId) {
      const campaign = await createSenderCampaign(issue, text(process.env.SENDER_GROUP_ID, 200), "Route 25 Collector Stories");
      campaignId = campaign.campaignId;
      await ref.update({ senderCampaignId: campaignId, senderGroup: "live", emailStatus: "sending", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      await ref.update({ emailStatus: "sending", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    const providerStatus = source.senderCampaignId ? await senderCampaignStatus(campaignId) : "draft";
    const retryAction = senderRetryAction(providerStatus);
    if (retryAction === "send") await sendSenderCampaign(campaignId);
    else if (retryAction === "wait") throw Object.assign(new Error(`Sender campaign is already ${providerStatus}; wait for it to finish before retrying.`), { status: 409 });
    await ref.update({ status: "published", publicVisibility: true, images, emailStatus: "sent", emailSentAt: admin.firestore.FieldValue.serverTimestamp(), publishedAt: admin.firestore.FieldValue.serverTimestamp(), preflightMissing: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    if (source.submissionId) await db.collection("newsletterSubmissions").doc(source.submissionId).set({ status: "published", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    try { await notifyEditorial(["*Collector Stories issue published and emailed*", `*${source.title}*`, `Sender campaign: ${campaignId}`, `<${process.env.PUBLIC_SITE_URL || "https://route25.app"}/newsletter/${source.slug}|View issue>`]); } catch (notifyError) { console.error(notifyError); }
    return { published: true, email: "sent", campaignId };
  } catch (error) {
    console.error("Sender live campaign failed", error);
    await ref.set({ status: "scheduled", publicVisibility: false, emailStatus: "failed", emailError: text(error.message, 500), emailFailedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    try { await notifyEditorial(["*:warning: Collector Stories publication blocked*", `*${source.title}* remains scheduled and hidden because Sender delivery failed.`, text(error.message, 500)]); } catch (notifyError) { console.error(notifyError); }
    throw error;
  }
}
async function ensureUploadCors() {
  if (uploadCorsReady) return uploadCorsReady;
  uploadCorsReady = (async () => {
    const [metadata] = await bucket.getMetadata();
    const current = Array.isArray(metadata.cors) ? metadata.cors : [];
    const origins = ["https://route25.app", "http://localhost:3000", "http://127.0.0.1:3000"];
    const alreadyCovered = current.some(rule => origins.every(origin => (rule.origin || []).includes(origin)) && (rule.method || []).includes("PUT"));
    if (!alreadyCovered) await bucket.setCorsConfiguration([...current, { origin: origins, method: ["PUT"], responseHeader: ["Content-Type", "x-goog-resumable"], maxAgeSeconds: 3600 }]);
  })().catch(error => { uploadCorsReady = null; throw error; });
  return uploadCorsReady;
}
function cronAuthorized(req) {
  const expected = text(process.env.CRON_SECRET, 500), supplied = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return Boolean(expected && supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)));
}
async function retryFailedSubscribers(limit = 100) {
  const snap = await db.collection("newsletterSubscribers").where("senderStatus", "==", "failed").limit(limit).get();
  let synced = 0, failed = 0;
  for (const doc of snap.docs) {
    const email = text(doc.data().email, 254);
    try {
      const result = await syncSubscriberToSender(email);
      await doc.ref.set({ senderStatus: "synced", senderSubscriberId: result.subscriberId, senderGroupId: result.groupId, senderSyncedAt: admin.firestore.FieldValue.serverTimestamp(), senderSyncError: admin.firestore.FieldValue.delete(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      synced += 1;
    } catch (error) {
      await doc.ref.set({ senderStatus: "failed", senderSyncError: text(error.message, 500), senderSyncFailedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      failed += 1;
    }
  }
  return { attempted: snap.size, synced, failed };
}
async function allCollectionDocuments(collectionName, pageSize = 500) {
  const documents = [];
  let cursor = null;
  do {
    let query = db.collection(collectionName).orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    documents.push(...page.docs);
    cursor = page.size === pageSize ? page.docs[page.docs.length - 1] : null;
  } while (cursor);
  return documents;
}
async function cleanupOrphanUploads() {
  const [submissionDocs, issueDocs, filesResult] = await Promise.all([
    allCollectionDocuments("newsletterSubmissions"),
    allCollectionDocuments("newsletterIssues"),
    bucket.getFiles({ prefix: "newsletter/submissions/" })
  ]);
  const referenced = new Set();
  for (const doc of submissionDocs) for (const image of doc.data().images || []) if (image.objectPath) referenced.add(image.objectPath);
  for (const doc of issueDocs) for (const image of doc.data().images || []) if (image.objectPath) referenced.add(image.objectPath);
  const cutoff = Date.now() - 48 * 60 * 60 * 1000, files = filesResult[0];
  let deleted = 0;
  for (const file of files) {
    if (referenced.has(file.name)) continue;
    const [metadata] = await file.getMetadata(), created = new Date(metadata.timeCreated || 0).getTime();
    if (created && created < cutoff) { await file.delete({ ignoreNotFound: true }); deleted += 1; }
  }
  return { scanned: files.length, referenced: referenced.size, deleted };
}
async function cleanupExpiredSubmissionSessions() {
  const snap = await db.collection("newsletterSubmissionSessions").where("expiresAt", "<", admin.firestore.Timestamp.now()).limit(500).get();
  if (snap.empty) return { deleted: 0 };
  const batch = db.batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
  return { deleted: snap.size };
}

module.exports = async (req, res) => {
  try {
    const action = text(req.query.action, 50);
    if (req.method !== "GET" && !sameOrigin(req)) return json(res, 403, { error: "Invalid origin" });

    if (action === "public-config" && req.method === "GET") {
      return json(res, 200, { turnstile: { enabled: turnstileConfigured(), siteKey: text(process.env.TURNSTILE_SITE_KEY, 500) } });
    }
    if (action === "start-submission" && req.method === "POST") {
      const ipHash = await checkRateLimit(req, "submission", 5, 60 * 60 * 1000);
      await verifyTurnstile(req, req.body?.turnstileToken, "newsletter_submission");
      return json(res, 200, { submissionToken: await createSubmissionSession(req, ipHash), expiresIn: 1800, maxUploads: MAX_UPLOADS });
    }
    if (action === "questions" && req.method === "GET") {
      let snap = await db.collection("newsletterQuestions").get();
      const existingIds = new Set(snap.docs.map(doc => doc.id));
      const missing = DEFAULT_QUESTIONS.filter(([id]) => !existingIds.has(id));
      if (missing.length) {
        const batch = db.batch();
        for (const [id, question, category] of missing) batch.set(db.collection("newsletterQuestions").doc(id), { text: question, category, active: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await batch.commit();
        snap = await db.collection("newsletterQuestions").get();
      }
      const excluded = new Set(text(req.query.exclude, 1000).split(",").map(x => x.trim()).filter(Boolean));
      const count = Math.max(1, Math.min(5, Number(req.query.count) || 5));
      const all = snap.docs.map(docData).filter(question => question.active === true && !excluded.has(question.id));
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      return json(res, 200, { questions: all.slice(0, count) });
    }
    if (action === "upload-url" && req.method === "POST") {
      const { contentType, size, filename } = req.body || {};
      if (!await authorizeSessionUpload(req, req.body?.submissionToken)) return json(res, 403, { error: "Your upload session expired or has reached its 15-image limit. Please verify again." });
      if (!IMAGE_TYPES.has(contentType) || !Number.isInteger(size) || size < 1 || size > MAX_IMAGE_BYTES) return json(res, 400, { error: "Images must be JPEG, PNG, WebP, or HEIC and 10 MB or less." });
      const ext = ({"image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/heic":"heic"})[contentType];
      await ensureUploadCors();
      const objectPath = `newsletter/submissions/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;
      const file = bucket.file(objectPath);
      const [uploadUrl] = await file.getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 10 * 60 * 1000, contentType });
      return json(res, 200, { uploadUrl, objectPath, originalName: text(filename, 200) });
    }
    if (action === "submit" && req.method === "POST") {
      const b = req.body || {};
      const trainerId = normalizeTrainerId(b.trainerId);
      if (text(b.trainerId, 128) && !trainerId) return json(res, 400, { error: "Route 25 Trainer ID contains unsupported characters." });
      const images = Array.isArray(b.images) ? b.images.slice(0, MAX_IMAGES) : [];
      if (!text(b.name, 120) || !/^\S+@\S+\.\S+$/.test(text(b.email, 254)) || !text(b.bio, 3000) || !text(b.collectionFocus, 1000)) return json(res, 400, { error: "Name, valid email, bio, and collection focus are required." });
      const consentRights = b.consentRights === true || (b.consentPublish && b.consentOriginal && b.consentTerms);
      if (!consentRights || !b.consentCommunity) return json(res, 400, { error: "Both permission and community-standard fields are required." });
      if (!images.length) return json(res, 400, { error: "At least one image is required." });
      const checked = [];
      for (const image of images) {
        const objectPath = text(image?.objectPath, 500);
        if (!/^newsletter\/submissions\/[0-9-]+\/[a-f0-9-]+\.(jpg|png|webp|heic)$/.test(objectPath)) return json(res, 400, { error: "Invalid image reference." });
        const [meta] = await bucket.file(objectPath).getMetadata();
        if (Number(meta.size) > MAX_IMAGE_BYTES || !IMAGE_TYPES.has(meta.contentType)) { await bucket.file(objectPath).delete({ ignoreNotFound: true }); return json(res, 400, { error: "An uploaded image failed validation." }); }
        checked.push({ objectPath, contentType: meta.contentType, size: Number(meta.size), caption: text(image.caption, 500), alt: text(image.alt, 300) });
      }
      if (!await consumeSubmissionSession(req, b.submissionToken)) return json(res, 409, { error: "This submission session has expired or was already used. Refresh the page to submit another application." });
      const now = admin.firestore.FieldValue.serverTimestamp();
      const interviewAnswers = normalizeAnswers(b.interviewAnswers);
      const flags = languageFlags([text(b.bio,3000), text(b.collectionFocus,1000), text(b.favorite,1000), text(b.currentChase,1000), text(b.grail,1000), ...interviewAnswers.map(answer => answer.answer)]);
      const submission = { status: "submitted", name: text(b.name,120), email: text(b.email,254).toLowerCase(), location: text(b.location,200), trainerId, socials: list(b.socials,1).filter(url => /^https:\/\//i.test(url)), bio: text(b.bio,3000), collectionFocus: text(b.collectionFocus,1000), favorite: text(b.favorite,1000), currentChase: text(b.currentChase,1000), grail: text(b.grail,1000), gear: list(b.gear,20), interviewAnswers, images: checked, moderation: { status: flags.length ? "flagged" : "clear", flags }, consent: { publish: true, original: true, terms: true, community: true, attributionName: text(b.attributionName,120) || text(b.name,120), submittedAt: now }, createdAt: now, updatedAt: now };
      const ref = await db.collection("newsletterSubmissions").add(submission);
      try { if (await notifyNewSubmission(submission)) await ref.update({ slackNotifiedAt: admin.firestore.FieldValue.serverTimestamp() }); } catch (error) { console.error(error); }
      return json(res, 201, { id: ref.id, status: "submitted" });
    }
    if (action === "subscribe" && req.method === "POST") {
      await checkRateLimit(req, "subscribe", 10, 60 * 60 * 1000);
      await verifyTurnstile(req, req.body?.turnstileToken, "newsletter_subscribe");
      const email = text(req.body?.email, 254).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email) || req.body?.consent !== true) return json(res, 400, { error: "A valid email and consent are required." });
      const id = crypto.createHash("sha256").update(email).digest("hex");
      const ref = db.collection("newsletterSubscribers").doc(id);
      await ref.set({ email, status: "subscribed", source: text(req.body?.source, 100) || "archive", consentAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      let senderSynced = false;
      try {
        const synced = await syncSubscriberToSender(email);
        await ref.set({ senderStatus: "synced", senderSubscriberId: synced.subscriberId, senderGroupId: synced.groupId, senderSyncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        senderSynced = true;
      } catch (error) {
        console.error("Sender subscriber sync failed", error);
        await ref.set({ senderStatus: "failed", senderSyncError: text(error.message, 500), senderSyncFailedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
      return json(res, 201, { ok: true, senderSynced });
    }
    if (action === "issues" && req.method === "GET") {
      const snap = await db.collection("newsletterIssues").where("status", "==", "published").limit(100).get();
      const issues = snap.docs.map(docData).filter(isPublicIssue).sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))).slice(0, 50).map(({ emailHtml, emailNoteHtml, emailNoteMarkdown, previewToken, ...x }) => x);
      return json(res, 200, { issues });
    }
    if (action === "issue" && req.method === "GET") {
      const slug = safeSlug(req.query.slug); const snap = await db.collection("newsletterIssues").where("slug", "==", slug).limit(1).get();
      if (snap.empty || snap.docs[0].data().status !== "published" || !isPublicIssue(snap.docs[0].data())) return json(res, 404, { error: "Issue not found" });
      const { emailNoteHtml, emailNoteMarkdown, ...issue } = docData(snap.docs[0]);
      return json(res, 200, { issue });
    }
    if (action === "issue-preview" && req.method === "GET") {
      const token = text(req.query.token, 100);
      if (!/^[a-f0-9]{64}$/.test(token)) return json(res, 404, { error: "Preview not found" });
      const snap = await db.collection("newsletterIssues").where("previewToken", "==", token).limit(1).get();
      if (snap.empty) return json(res, 404, { error: "Preview not found" });
      const issue = docData(snap.docs[0]);
      issue.images = await Promise.all((issue.images || []).map(async image => {
        if (!image.objectPath) return image;
        const [url] = await bucket.file(image.objectPath).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 86400000 });
        return { ...image, url };
      }));
      return json(res, 200, { issue });
    }
    if (action === "publish-due" && (req.method === "GET" || req.method === "POST")) {
      if (!cronAuthorized(req)) return json(res, 401, { error: "Unauthorized" });
      if (!isWeeklyPublicationSlot()) return json(res, 200, { published: 0, skipped: "Outside Saturday 7:00 AM America/Denver publication window" });
      const snap = await db.collection("newsletterIssues").where("status", "==", "scheduled").limit(100).get();
      const now = new Date(), due = snap.docs.filter(doc => isCurrentPublicationWindow(doc.data().publishAt?.toDate?.(), now)).sort((a,b) => a.data().publishAt.toMillis() - b.data().publishAt.toMillis()).slice(0, 1);
      const results = [];
      for (const doc of due) {
        const data = doc.data();
        try {
          results.push({ id: doc.id, ...(await deliverAndPublishIssue(doc.ref, data)) });
        } catch (error) {
          results.push({ id: doc.id, published: false, email: "blocked", error: text(error.message, 500) });
        }
      }
      return json(res, 200, { published: due.length, results });
    }
    if (action === "maintenance" && (req.method === "GET" || req.method === "POST")) {
      if (!cronAuthorized(req)) return json(res, 401, { error: "Unauthorized" });
      const [uploads, subscribers, submissionSessions] = await Promise.all([cleanupOrphanUploads(), retryFailedSubscribers(100), cleanupExpiredSubmissionSessions()]);
      return json(res, 200, { ok: true, uploads, subscribers, submissionSessions });
    }

    await requireAdmin(req);
    if (action === "admin-list" && req.method === "GET") {
      const snap = await db.collection("newsletterSubmissions").orderBy("createdAt", "desc").limit(100).get();
      const submissions = await Promise.all(snap.docs.map(async d => {
        const item = docData(d); item.images = await Promise.all((item.images || []).map(async image => {
          const [url] = await bucket.file(image.objectPath).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 86400000 });
          return { ...image, url };
        })); return item;
      }));
      return json(res, 200, { submissions });
    }
    if (action === "admin-issues" && req.method === "GET") {
      const snap = await db.collection("newsletterIssues").limit(100).get();
      const config = deliveryConfig(), now = Date.now();
      const issues = snap.docs.map(doc => {
        const item = docData(doc), publishTime = item.publishAt ? new Date(item.publishAt).getTime() : 0;
        const normalized = { ...item, isTest: item.isTest === true || !isPublicIssue(item) };
        return { ...normalized, preflight: publicationPreflight(normalized, config), missedPublication: item.status === "scheduled" && publishTime > 0 && publishTime < now - 90 * 60 * 1000 };
      }).sort((a,b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      const nextIssueNumber = Math.max(0, ...issues.filter(issue => !issue.isTest).map(issue => Number(issue.issueNumber) || 0)) + 1;
      return json(res, 200, { issues, nextIssueNumber });
    }
    if (action === "admin-email-config" && req.method === "GET") {
      const testGroupId = text(process.env.SENDER_TEST_GROUP_ID, 200), liveGroupId = text(process.env.SENDER_GROUP_ID, 200);
      const failedSubscribers = await db.collection("newsletterSubscribers").where("senderStatus", "==", "failed").limit(100).get();
      return json(res, 200, { configured: senderConfigured(), testGroupConfigured: Boolean(testGroupId), liveGroupConfigured: Boolean(liveGroupId), groupsDistinct: Boolean(testGroupId && liveGroupId && testGroupId !== liveGroupId), liveSendEnabled: /^true$/i.test(text(process.env.NEWSLETTER_LIVE_SEND_ENABLED, 10)), fromName: text(process.env.SENDER_FROM_NAME, 200), fromEmail: text(process.env.SENDER_FROM_EMAIL, 254), failedSubscriberSyncs: failedSubscribers.size, turnstileConfigured: turnstileConfigured() });
    }
    if (action === "admin-retry-subscribers" && req.method === "POST") {
      return json(res, 200, await retryFailedSubscribers(100));
    }
    if (action === "admin-update" && req.method === "PATCH") {
      const id = text(req.query.id,100), b = req.body || {}; if (!id || !STATUSES.has(b.status)) return json(res,400,{error:"Valid id and status required"});
      await db.collection("newsletterSubmissions").doc(id).update({ status: b.status, reviewNotes: text(b.reviewNotes,5000), scheduledIssue: text(b.scheduledIssue,100), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return json(res,200,{ok:true});
    }
    if (action === "admin-delete-submission" && req.method === "DELETE") {
      const id = text(req.query.id, 100), ref = db.collection("newsletterSubmissions").doc(id), snap = await ref.get();
      if (!snap.exists) return json(res, 404, { error: "Application not found" });
      if (snap.data().status !== "declined") return json(res, 409, { error: "Mark the application declined before deleting it." });
      const linkedIssues = await db.collection("newsletterIssues").where("submissionId", "==", id).limit(10).get();
      if (!linkedIssues.empty) return json(res, 409, { error: "This application is linked to an editorial issue. Delete the test issue or preserve the application." });
      const allIssues = await allCollectionDocuments("newsletterIssues"), issueImages = new Set(allIssues.flatMap(doc => (doc.data().images || []).map(image => image.objectPath).filter(Boolean)));
      for (const image of snap.data().images || []) if (image.objectPath && !issueImages.has(image.objectPath)) await bucket.file(image.objectPath).delete({ ignoreNotFound: true });
      await ref.delete();
      return json(res, 200, { ok: true, deleted: id });
    }
    if (action === "admin-save-issue" && req.method === "POST") {
      const b = req.body || {}, slug = safeSlug(b.slug || b.title); if (!slug || !text(b.title,200) || !text(b.summary,2000)) return json(res,400,{error:"Title, slug, and summary required"});
      const trainerId = normalizeTrainerId(b.trainerId);
      if (text(b.trainerId, 128) && !trainerId) return json(res, 400, { error: "Route 25 Trainer ID contains unsupported characters." });
      const requestedStatus = ["draft", "scheduled"].includes(b.status) ? b.status : "draft";
      const status = b.isTest === true ? "draft" : requestedStatus;
      const parsedPublishAt = b.publishAt ? new Date(b.publishAt) : null;
      if (status === "scheduled" && (!parsedPublishAt || !Number.isFinite(parsedPublishAt.getTime()) || parsedPublishAt.getTime() <= Date.now() || !isExactPublicationSlot(parsedPublishAt))) return json(res, 400, { error: "Choose a future Saturday publication date; issues publish at 7:00 AM Mountain." });
      const existing = await db.collection("newsletterIssues").where("slug","==",slug).limit(1).get();
      let issueNumber = Number(b.issueNumber);
      if (b.isTest !== true && (!Number.isInteger(issueNumber) || issueNumber < 1)) {
        const numberedIssues = await db.collection("newsletterIssues").limit(1000).get();
        issueNumber = Math.max(0, ...numberedIssues.docs.filter(doc => doc.id !== existing.docs[0]?.id && isPublicIssue(doc.data())).map(doc => Number(doc.data().issueNumber) || 0)) + 1;
      }
      const issue = { slug, title:text(b.title,200), issueNumber:Number.isInteger(issueNumber)&&issueNumber>0?issueNumber:null, emailNoteMarkdown:text(b.emailNoteMarkdown,10000), dek:text(b.dek,500), summary:text(b.summary,2000), bodyHtml:text(b.bodyHtml,50000), trainerName:text(b.trainerName,120), trainerId, socialUrl:normalizeSocialUrl(b.socialUrl), submissionId:text(b.submissionId,100), images:await normalizeIssueImages(b.images, status === "published"), interviewAnswers:normalizeAnswers(b.interviewAnswers), products:normalizeProducts(b.products), pokemonTags:list(b.pokemonTags,30), cardTags:list(b.cardTags,30), setTags:list(b.setTags,30), collectionTags:list(b.collectionTags,30), status, isTest:b.isTest === true, publicVisibility:b.isTest !== true, publishAt: status === "scheduled" ? admin.firestore.Timestamp.fromDate(parsedPublishAt) : null, subscribeUrl:/^https:\/\//.test(text(b.subscribeUrl,2000))?text(b.subscribeUrl,2000):"", updatedAt:admin.firestore.FieldValue.serverTimestamp() };
      if (status === "scheduled") {
        const scheduled = await db.collection("newsletterIssues").where("status", "==", "scheduled").limit(100).get();
        const conflict = scheduled.docs.find(doc => doc.id !== existing.docs[0]?.id && doc.data().publishAt?.toMillis?.() === parsedPublishAt.getTime());
        if (conflict) return json(res, 409, { error: `That Saturday is already assigned to “${text(conflict.data().title, 200)}”. Choose another week.` });
        const numbered = await db.collection("newsletterIssues").where("issueNumber", "==", issue.issueNumber).limit(5).get();
        if (numbered.docs.some(doc => doc.id !== existing.docs[0]?.id)) return json(res, 409, { error: `Issue #${issue.issueNumber} is already in use. Choose another number.` });
        const preflight = publicationPreflight({ ...issue, lastTestEmailAt: existing.docs[0]?.data()?.lastTestEmailAt }, deliveryConfig());
        if (!preflight.readyToSchedule) return json(res, 409, { error: `Scheduling blocked: ${preflight.checks.filter(check => check.blocking && !check.ok).map(check => check.label).join(", ")}. Save a draft, complete these items, and try again.`, preflight });
      }
      const ref = existing.empty ? db.collection("newsletterIssues").doc() : existing.docs[0].ref;
      const previewToken = existing.empty ? crypto.randomBytes(32).toString("hex") : (existing.docs[0].data().previewToken || crypto.randomBytes(32).toString("hex"));
      const previous = existing.empty ? {} : existing.docs[0].data(), resetUnsentCampaign = previous.senderCampaignId && previous.emailStatus !== "sent" && status !== "published";
      await ref.set({ ...issue, previewToken, ...(resetUnsentCampaign ? { senderCampaignId: admin.firestore.FieldValue.delete(), senderGroup: admin.firestore.FieldValue.delete(), emailStatus: "not-sent", emailError: admin.firestore.FieldValue.delete() } : {}), createdAt: existing.empty ? admin.firestore.FieldValue.serverTimestamp() : previous.createdAt }, { merge:true });
      if (issue.submissionId) await db.collection("newsletterSubmissions").doc(issue.submissionId).set({ status: issue.status, scheduledIssue: ref.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return json(res,200,{id:ref.id,slug,issueNumber:issue.issueNumber});
    }
    if (action === "admin-issue-action" && req.method === "POST") {
      const operation = text(req.body?.operation, 50), id = text(req.body?.id, 100);
      if (operation === "delete-test") {
        if (!id) return json(res, 400, { error: "Issue id required" });
        const deleteRef = db.collection("newsletterIssues").doc(id), deleteSnap = await deleteRef.get();
        if (!deleteSnap.exists) return json(res, 404, { error: "Issue not found" });
        const candidate = deleteSnap.data(), recognizedTest = candidate.isTest === true || candidate.publicVisibility === false || /^test(?:\b|-)/i.test(text(candidate.trainerName || candidate.slug || candidate.title, 200));
        if (!recognizedTest) return json(res, 403, { error: "Only test/hidden issues can be deleted from this control." });
        await deleteRef.delete();
        return json(res, 200, { ok: true, deleted: id });
      }
      const slug = safeSlug(req.body?.slug);
      const snap = await db.collection("newsletterIssues").where("slug", "==", slug).limit(1).get();
      if (snap.empty) return json(res, 404, { error: "Issue not found" });
      const ref = snap.docs[0].ref, issue = snap.docs[0].data();
      if (operation === "unschedule") {
        if (issue.status !== "scheduled") return json(res, 409, { error: "Only scheduled issues can be unscheduled." });
        await ref.update({ status: "draft", publishAt: null, emailStatus: issue.senderCampaignId ? "draft-campaign-exists" : "not-sent", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        if (issue.submissionId) await db.collection("newsletterSubmissions").doc(issue.submissionId).set({ status: "draft", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return json(res, 200, { ok: true, status: "draft" });
      }
      if (["publish-now", "retry"].includes(operation)) {
        if (issue.status !== "scheduled") return json(res, 409, { error: "Only scheduled issues can be delivered." });
        return json(res, 200, { ok: true, ...(await deliverAndPublishIssue(ref, issue)) });
      }
      return json(res, 400, { error: "Unknown issue action" });
    }
    if (action === "email-export" && req.method === "GET") {
      const slug=safeSlug(req.query.slug), snap=await db.collection("newsletterIssues").where("slug","==",slug).limit(1).get(); if(snap.empty)return json(res,404,{error:"Issue not found"});
      const i=docData(snap.docs[0]), email=buildEmail(i);
      return json(res,200,{subject:email.subject,previewText:email.preheader,html:email.content,text:`${i.title}\n\n${i.summary}\n\nSee the full collection tour: ${email.canonicalUrl}`,canonicalUrl:email.canonicalUrl});
    }
    if (action === "admin-test-email" && req.method === "POST") {
      const slug = safeSlug(req.body?.slug), snap = await db.collection("newsletterIssues").where("slug", "==", slug).limit(1).get();
      if (snap.empty) return json(res, 404, { error: "Issue not found" });
      const issue = docData(snap.docs[0]);
      const groupId = text(process.env.SENDER_TEST_GROUP_ID, 200), liveGroupId = text(process.env.SENDER_GROUP_ID, 200);
      if (!groupId || !liveGroupId) return json(res, 503, { error: "Both Sender test and live groups must be configured" });
      if (groupId === liveGroupId) return json(res, 409, { error: "Test send blocked: the Sender test and live group IDs must be different" });
      const group = (await senderRequest(`/groups/${encodeURIComponent(groupId)}`))?.data || {};
      const activeSubscribers = Number(group.active_subscribers);
      if (!/test/i.test(text(group.title, 200)) || !Number.isFinite(activeSubscribers) || activeSubscribers > 5) return json(res, 409, { error: "Test send blocked: Sender target must be a test-named group with no more than 5 active subscribers" });
      const previewToken = issue.previewToken || crypto.randomBytes(32).toString("hex");
      if (!issue.previewToken) await snap.docs[0].ref.set({ previewToken }, { merge: true });
      const previewUrl = `${(process.env.PUBLIC_SITE_URL || "https://route25.app").replace(/\/$/, "")}/newsletter/preview/${previewToken}`;
      const campaign = await createSenderCampaign({ ...issue, emailCanonicalUrl: previewUrl }, groupId, "TEST");
      await sendSenderCampaign(campaign.campaignId);
      await snap.docs[0].ref.set({ lastTestEmailAt: admin.firestore.FieldValue.serverTimestamp(), lastTestCampaignId: campaign.campaignId, testEmailCount: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return json(res, 200, { ok: true, campaignId: campaign.campaignId, recipient: "test-group" });
    }
    return json(res,404,{error:"Unknown action"});
  } catch (error) { console.error(error); return json(res,error.status||500,{error:error.status?error.message:"Unexpected server error"}); }
};
