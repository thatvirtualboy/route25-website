const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const path = require("path");
const sharp = require("sharp");
const { FONT_FAMILY, renderNewsletterSocialCanvas } = require("../lib/newsletter-og-canvas");

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  admin.initializeApp({ credential: raw ? admin.credential.cert(JSON.parse(raw)) : admin.credential.applicationDefault(), storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
}
const db = process.env.FIRESTORE_DATABASE_ID ? getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID) : getFirestore(admin.app());
const imageCache = new Map();
const FONT_FILES = [
  { file: "geist-sans-latin-400-normal.woff", weight: 400 },
  { file: "geist-sans-latin-700-normal.woff", weight: 700 },
  { file: "geist-sans-latin-900-normal.woff", weight: 900 }
];

function safeSlug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function approvedPhotoUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "storage.googleapis.com" || host === "firebasestorage.googleapis.com" || host.endsWith(".googleusercontent.com")) ? url.toString() : "";
  } catch {
    return "";
  }
}

function dataUrl(buffer, mime) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function socialPhoto(value) {
  const source = approvedPhotoUrl(value);
  if (!source) return "";
  if (imageCache.has(source)) return imageCache.get(source);
  const response = await fetch(source, { headers: { accept: "image/jpeg,image/png,image/webp" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`Story image fetch failed with ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 15 * 1024 * 1024) throw new Error("Story image is too large for a social preview");
  const input = Buffer.from(await response.arrayBuffer());
  if (input.length > 15 * 1024 * 1024) throw new Error("Story image is too large for a social preview");
  const output = await sharp(input).resize(948, 1092, { fit: "cover", position: "attention" }).jpeg({ quality: 86 }).toBuffer();
  const result = dataUrl(output, "image/jpeg");
  imageCache.set(source, result);
  return result;
}

function iconDataUrl() {
  return dataUrl(readFileSync(path.join(process.cwd(), "assets", "Icon.png")), "image/png");
}

function fonts() {
  return FONT_FILES.map(({ file, weight }) => {
    const buffer = readFileSync(path.join(process.cwd(), "assets", "fonts", file));
    return { name: FONT_FAMILY, data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), weight, style: "normal" };
  });
}

module.exports = async (req, res) => {
  const slug = safeSlug(req.query?.slug);
  if (!slug) {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.end("Story not found");
  }
  try {
    const snap = await db.collection("newsletterIssues").where("slug", "==", slug).limit(1).get();
    const issue = snap.empty ? null : snap.docs[0].data();
    if (!issue || issue.status !== "published" || issue.publicVisibility !== true || issue.isTest === true) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      return res.end("Story not found");
    }
    const hero = await socialPhoto(issue.images?.[0]?.url).catch(error => {
      console.warn("Newsletter social image photo fallback", error.message);
      return "";
    });
    const { ImageResponse } = await import("@vercel/og");
    const image = new ImageResponse(renderNewsletterSocialCanvas(issue, { image: hero, icon: iconDataUrl() }), {
      width: 1200,
      height: 630,
      fonts: fonts()
    });
    const arrayBuffer = await image.arrayBuffer();
    res.statusCode = 200;
    res.setHeader("content-type", "image/png");
    res.setHeader("cache-control", "public, max-age=0, must-revalidate");
    res.setHeader("cdn-cache-control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("vercel-cdn-cache-control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.end("Could not render story preview");
  }
};
