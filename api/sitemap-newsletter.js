const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  admin.initializeApp({ credential: raw ? admin.credential.cert(JSON.parse(raw)) : admin.credential.applicationDefault(), storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
}
const db = process.env.FIRESTORE_DATABASE_ID ? getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID) : getFirestore(admin.app());
const SITE = (process.env.PUBLIC_SITE_URL || "https://route25.app").replace(/\/$/, "");
function xml(value) { return String(value || "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" })[char]); }

module.exports = async (_req, res) => {
  try {
    const snap = await db.collection("newsletterIssues").where("status", "==", "published").limit(500).get();
    const urls = snap.docs.map(doc => doc.data()).filter(issue => issue.publicVisibility === true && issue.isTest !== true && issue.slug).map(issue => {
      const modified = issue.updatedAt?.toDate?.()?.toISOString?.() || issue.publishedAt?.toDate?.()?.toISOString?.() || new Date().toISOString();
      return `<url><loc>${xml(`${SITE}/newsletter/${issue.slug}`)}</loc><lastmod>${xml(modified)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`;
    }).join("");
    res.statusCode = 200;
    res.setHeader("content-type", "application/xml; charset=utf-8");
    res.setHeader("cache-control", "s-maxage=300, stale-while-revalidate=3600");
    res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Unable to generate newsletter sitemap");
  }
};
