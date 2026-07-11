const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("node:crypto");

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
const SENDER_API_BASE = "https://api.sender.net/v2";
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
  ["gear", "Which piece of collecting gear has earned your trust?", "gear"]
];

function json(res, status, body) {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}
function text(v, max = 5000) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }
function list(v, max = 20) { return Array.isArray(v) ? v.slice(0, max).map(x => text(x, 500)).filter(Boolean) : []; }
function safeSlug(v) { return text(v, 100).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function html(v) { return String(v || "").replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers["x-forwarded-host"] || req.headers.host); } catch { return false; }
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
    url: /^https:\/\//.test(text(p?.url, 2000)) ? text(p.url, 2000) : "",
    note: text(p?.note, 500)
  })).filter(p => p.name) : [];
}
function normalizeAnswers(v) {
  return Array.isArray(v) ? v.slice(0, 10).map(a => ({ questionId: text(a?.questionId, 100), question: text(a?.question, 500), answer: text(a?.answer, 5000) })).filter(a => a.question && a.answer) : [];
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
function docData(doc) {
  const d = doc.data(), iso = value => value?.toDate?.()?.toISOString?.() || value;
  return { id: doc.id, ...d, createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt), publishedAt: iso(d.publishedAt), publishAt: iso(d.publishAt), lastTestEmailAt: iso(d.lastTestEmailAt), emailSentAt: iso(d.emailSentAt), emailFailedAt: iso(d.emailFailedAt), emailSkippedAt: iso(d.emailSkippedAt) };
}
function isWeeklyPublicationSlot(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return parts.weekday === "Sat" && Number(parts.hour) === 7;
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
  const canonicalUrl = `${site}/newsletter/${issue.slug}`;
  const hero = (issue.images || []).find(image => /^https:\/\//.test(image.url || ""));
  const products = (issue.products || []).filter(product => product.name).slice(0, 4);
  const gear = products.length ? `<div style="margin-top:28px;padding:22px;background:#111827;border:1px solid #263246;border-radius:16px"><h2 style="margin:0 0 14px;color:#fff;font-size:20px">Gear spotlight</h2>${products.map(product => `<p style="margin:10px 0;color:#d1d5db"><strong style="color:#fff">${html(product.name)}</strong>${product.note ? ` — ${html(product.note)}` : ""}${product.url ? ` <a href="${html(product.url)}" style="color:#38bdf8">View</a>` : ""}</p>`).join("")}</div>` : "";
  const content = `<div style="display:none;max-height:0;overflow:hidden">${html(issue.dek || issue.summary).slice(0, 180)}</div><div style="margin:0;background:#050811;padding:28px 12px;font-family:Arial,sans-serif;color:#f5f7fb"><div style="max-width:640px;margin:auto"><p style="color:#38bdf8;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Route 25 · Collector Stories</p><h1 style="font-size:38px;line-height:1.08;margin:10px 0 14px;color:#fff">${html(issue.title)}</h1><p style="font-size:18px;line-height:1.6;color:#cbd5e1">${html(issue.summary)}</p>${hero ? `<img src="${html(hero.url)}" alt="${html(hero.alt || issue.title)}" style="display:block;width:100%;height:auto;border-radius:18px;margin:24px 0">` : ""}<p style="margin:26px 0"><a href="${html(canonicalUrl)}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;font-weight:bold;padding:14px 20px;border-radius:999px">See the full collection tour</a></p>${gear}<p style="margin-top:30px;color:#94a3b8;font-size:12px;line-height:1.5">Some links may be affiliate links. Purchases support Route 25 at no additional cost to you.</p><p style="margin-top:18px;color:#64748b;font-size:11px"><a href="{{unsubscribe_link}}" style="color:#94a3b8">{{unsubscribe_text}}</a></p></div></div>`;
  return { subject: issue.title, preheader: issue.dek || String(issue.summary || "").slice(0, 140), content, canonicalUrl };
}
async function createSenderCampaign(issue, groupId, label) {
  if (!senderConfigured() || !groupId) throw Object.assign(new Error("Sender campaign delivery is not configured"), { status: 503 });
  const email = buildEmail(issue);
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

module.exports = async (req, res) => {
  try {
    const action = text(req.query.action, 50);
    if (req.method !== "GET" && !sameOrigin(req)) return json(res, 403, { error: "Invalid origin" });

    if (action === "questions" && req.method === "GET") {
      let snap = await db.collection("newsletterQuestions").where("active", "==", true).get();
      if (snap.empty) {
        const batch = db.batch();
        for (const [id, question, category] of DEFAULT_QUESTIONS) batch.set(db.collection("newsletterQuestions").doc(id), { text: question, category, active: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await batch.commit();
        snap = await db.collection("newsletterQuestions").where("active", "==", true).get();
      }
      const all = snap.docs.map(docData);
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      return json(res, 200, { questions: all.slice(0, 5) });
    }
    if (action === "upload-url" && req.method === "POST") {
      const { contentType, size, filename } = req.body || {};
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
      const images = Array.isArray(b.images) ? b.images.slice(0, MAX_IMAGES) : [];
      if (!text(b.name, 120) || !/^\S+@\S+\.\S+$/.test(text(b.email, 254)) || !text(b.bio, 3000) || !text(b.collectionFocus, 1000)) return json(res, 400, { error: "Name, valid email, bio, and collection focus are required." });
      if (!b.consentPublish || !b.consentOriginal || !b.consentTerms) return json(res, 400, { error: "All permission fields are required." });
      if (!images.length) return json(res, 400, { error: "At least one image is required." });
      const checked = [];
      for (const image of images) {
        const objectPath = text(image?.objectPath, 500);
        if (!/^newsletter\/submissions\/[0-9-]+\/[a-f0-9-]+\.(jpg|png|webp|heic)$/.test(objectPath)) return json(res, 400, { error: "Invalid image reference." });
        const [meta] = await bucket.file(objectPath).getMetadata();
        if (Number(meta.size) > MAX_IMAGE_BYTES || !IMAGE_TYPES.has(meta.contentType)) { await bucket.file(objectPath).delete({ ignoreNotFound: true }); return json(res, 400, { error: "An uploaded image failed validation." }); }
        checked.push({ objectPath, contentType: meta.contentType, size: Number(meta.size), caption: text(image.caption, 500), alt: text(image.alt, 300) });
      }
      const now = admin.firestore.FieldValue.serverTimestamp();
      const submission = { status: "submitted", name: text(b.name,120), email: text(b.email,254).toLowerCase(), location: text(b.location,200), socials: list(b.socials,5), bio: text(b.bio,3000), collectionFocus: text(b.collectionFocus,1000), favorite: text(b.favorite,1000), currentChase: text(b.currentChase,1000), grail: text(b.grail,1000), gear: list(b.gear,20), interviewAnswers: normalizeAnswers(b.interviewAnswers), images: checked, consent: { publish: true, original: true, terms: true, attributionName: text(b.attributionName,120) || text(b.name,120), submittedAt: now }, createdAt: now, updatedAt: now };
      const ref = await db.collection("newsletterSubmissions").add(submission);
      try { if (await notifyNewSubmission(submission)) await ref.update({ slackNotifiedAt: admin.firestore.FieldValue.serverTimestamp() }); } catch (error) { console.error(error); }
      return json(res, 201, { id: ref.id, status: "submitted" });
    }
    if (action === "subscribe" && req.method === "POST") {
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
      const issues = snap.docs.map(docData).sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))).slice(0, 50).map(({ emailHtml, ...x }) => x);
      return json(res, 200, { issues });
    }
    if (action === "issue" && req.method === "GET") {
      const slug = safeSlug(req.query.slug); const snap = await db.collection("newsletterIssues").where("slug", "==", slug).limit(1).get();
      if (snap.empty || snap.docs[0].data().status !== "published") return json(res, 404, { error: "Issue not found" });
      return json(res, 200, { issue: docData(snap.docs[0]) });
    }
    if (action === "publish-due" && (req.method === "GET" || req.method === "POST")) {
      const expected = text(process.env.CRON_SECRET, 500);
      const supplied = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!expected || !crypto.timingSafeEqual(Buffer.from(supplied.padEnd(expected.length).slice(0, expected.length)), Buffer.from(expected))) return json(res, 401, { error: "Unauthorized" });
      if (!isWeeklyPublicationSlot()) return json(res, 200, { published: 0, skipped: "Outside Saturday 7:00 AM America/Denver publication window" });
      const snap = await db.collection("newsletterIssues").where("status", "==", "scheduled").limit(100).get();
      const now = Date.now(), due = snap.docs.filter(doc => doc.data().publishAt?.toMillis?.() <= now);
      const results = [];
      for (const doc of due) {
        const data = doc.data();
        const images = await normalizeIssueImages(data.images, true);
        const published = { ...data, images, status: "published" };
        const liveEnabled = /^true$/i.test(text(process.env.NEWSLETTER_LIVE_SEND_ENABLED, 10));
        const baseUpdate = { status: "published", images, publishedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (!liveEnabled) {
          await doc.ref.update({ ...baseUpdate, emailStatus: "live-disabled", emailSkippedAt: admin.firestore.FieldValue.serverTimestamp() });
          results.push({ id: doc.id, published: true, email: "live-disabled" });
          continue;
        }
        const groupId = text(process.env.SENDER_GROUP_ID, 200);
        const claimed = await db.runTransaction(async transaction => {
          const current = await transaction.get(doc.ref);
          if (!current.exists || current.data().status !== "scheduled") return false;
          transaction.update(doc.ref, { ...baseUpdate, emailStatus: "preparing" });
          return true;
        });
        if (!claimed) { results.push({ id: doc.id, published: false, email: "already-claimed" }); continue; }
        try {
          const campaign = await createSenderCampaign(published, groupId, "Route 25 Collector Stories");
          await doc.ref.update({ emailStatus: "sending", senderCampaignId: campaign.campaignId, senderGroup: "live", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          await sendSenderCampaign(campaign.campaignId);
          await doc.ref.update({ emailStatus: "sent", emailSentAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          try { await notifyEditorial(["*Collector Stories issue published and emailed*", `*${data.title}*`, `Sender campaign: ${campaign.campaignId}`, `<${process.env.PUBLIC_SITE_URL || "https://route25.app"}/newsletter/${data.slug}|View issue>`]); } catch (notifyError) { console.error(notifyError); }
          results.push({ id: doc.id, published: true, email: "sent", campaignId: campaign.campaignId });
        } catch (error) {
          console.error("Sender live campaign failed", error);
          await doc.ref.set({ emailStatus: "failed", emailError: text(error.message, 500), emailFailedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
          try { await notifyEditorial(["*:warning: Collector Stories email failed*", `*${data.title}* published on the website, but Sender delivery failed.`, text(error.message, 500)]); } catch (notifyError) { console.error(notifyError); }
          results.push({ id: doc.id, published: true, email: "failed" });
        }
      }
      return json(res, 200, { published: due.length, results });
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
      const issues = snap.docs.map(docData).sort((a,b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      return json(res, 200, { issues });
    }
    if (action === "admin-email-config" && req.method === "GET") {
      const testGroupId = text(process.env.SENDER_TEST_GROUP_ID, 200), liveGroupId = text(process.env.SENDER_GROUP_ID, 200);
      return json(res, 200, { configured: senderConfigured(), testGroupConfigured: Boolean(testGroupId), liveGroupConfigured: Boolean(liveGroupId), groupsDistinct: Boolean(testGroupId && liveGroupId && testGroupId !== liveGroupId), liveSendEnabled: /^true$/i.test(text(process.env.NEWSLETTER_LIVE_SEND_ENABLED, 10)), fromName: text(process.env.SENDER_FROM_NAME, 200), fromEmail: text(process.env.SENDER_FROM_EMAIL, 254) });
    }
    if (action === "admin-update" && req.method === "PATCH") {
      const id = text(req.query.id,100), b = req.body || {}; if (!id || !STATUSES.has(b.status)) return json(res,400,{error:"Valid id and status required"});
      await db.collection("newsletterSubmissions").doc(id).update({ status: b.status, reviewNotes: text(b.reviewNotes,5000), scheduledIssue: text(b.scheduledIssue,100), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return json(res,200,{ok:true});
    }
    if (action === "admin-save-issue" && req.method === "POST") {
      const b = req.body || {}, slug = safeSlug(b.slug || b.title); if (!slug || !text(b.title,200) || !text(b.summary,2000)) return json(res,400,{error:"Title, slug, and summary required"});
      const status = ["draft", "scheduled", "published"].includes(b.status) ? b.status : "draft";
      const parsedPublishAt = b.publishAt ? new Date(b.publishAt) : null;
      if (status === "scheduled" && (!parsedPublishAt || !Number.isFinite(parsedPublishAt.getTime()) || parsedPublishAt.getTime() <= Date.now())) return json(res, 400, { error: "Scheduled issues require a future publication date." });
      const issue = { slug, title:text(b.title,200), dek:text(b.dek,500), summary:text(b.summary,2000), bodyHtml:text(b.bodyHtml,50000), trainerName:text(b.trainerName,120), submissionId:text(b.submissionId,100), images:await normalizeIssueImages(b.images, status === "published"), interviewAnswers:normalizeAnswers(b.interviewAnswers), products:normalizeProducts(b.products), status, publishAt: status === "scheduled" ? admin.firestore.Timestamp.fromDate(parsedPublishAt) : null, subscribeUrl:/^https:\/\//.test(text(b.subscribeUrl,2000))?text(b.subscribeUrl,2000):"", updatedAt:admin.firestore.FieldValue.serverTimestamp() };
      if (issue.status === "published") issue.publishedAt = admin.firestore.FieldValue.serverTimestamp();
      const existing = await db.collection("newsletterIssues").where("slug","==",slug).limit(1).get();
      const ref = existing.empty ? db.collection("newsletterIssues").doc() : existing.docs[0].ref;
      await ref.set({ ...issue, createdAt: existing.empty ? admin.firestore.FieldValue.serverTimestamp() : existing.docs[0].data().createdAt }, { merge:true });
      return json(res,200,{id:ref.id,slug});
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
      if (/^true$/i.test(text(process.env.NEWSLETTER_LIVE_SEND_ENABLED, 10))) return json(res, 409, { error: "Test send blocked while live sending is enabled" });
      const group = (await senderRequest(`/groups/${encodeURIComponent(groupId)}`))?.data || {};
      const activeSubscribers = Number(group.active_subscribers);
      if (!/test/i.test(text(group.title, 200)) || !Number.isFinite(activeSubscribers) || activeSubscribers > 5) return json(res, 409, { error: "Test send blocked: Sender target must be a test-named group with no more than 5 active subscribers" });
      const campaign = await createSenderCampaign(issue, groupId, "TEST");
      await sendSenderCampaign(campaign.campaignId);
      await snap.docs[0].ref.set({ lastTestEmailAt: admin.firestore.FieldValue.serverTimestamp(), lastTestCampaignId: campaign.campaignId, testEmailCount: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return json(res, 200, { ok: true, campaignId: campaign.campaignId, recipient: "test-group" });
    }
    return json(res,404,{error:"Unknown action"});
  } catch (error) { console.error(error); return json(res,error.status||500,{error:error.status?error.message:"Unexpected server error"}); }
};
