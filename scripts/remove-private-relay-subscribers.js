const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { isPrivateRelayEmail } = require("../lib/newsletter-subscriber");

const SENDER_API_BASE = "https://api.sender.net/v2";
const apply = process.argv.includes("--apply");

function requireEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function allSubscribers(db, pageSize = 500) {
  const documents = [];
  let cursor = null;
  do {
    let query = db.collection("newsletterSubscribers").orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    documents.push(...page.docs);
    cursor = page.size === pageSize ? page.docs[page.docs.length - 1] : null;
  } while (cursor);
  return documents;
}

async function removeFromSender(groupId, emails) {
  const response = await fetch(`${SENDER_API_BASE}/subscribers/groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${requireEnvironment("SENDER_API_TOKEN")}`,
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ subscribers: emails })
  });
  if (!response.ok) throw new Error(`Sender group removal failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
}

async function main() {
  const rawCredential = requireEnvironment("FIREBASE_SERVICE_ACCOUNT_JSON");
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(rawCredential)),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
  const db = process.env.FIRESTORE_DATABASE_ID ? getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID) : getFirestore(admin.app());
  const documents = await allSubscribers(db);
  const candidates = documents.filter(doc => isPrivateRelayEmail(doc.data().email) && (doc.data().senderStatus !== "excluded" || doc.data().senderGroupId));
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", scanned: documents.length, matched: candidates.length }));
  if (!apply || !candidates.length) return;

  const groupId = requireEnvironment("SENDER_GROUP_ID");
  let removed = 0;
  for (let offset = 0; offset < candidates.length; offset += 100) {
    const chunk = candidates.slice(offset, offset + 100);
    await removeFromSender(groupId, chunk.map(doc => String(doc.data().email || "").trim().toLowerCase()));
    const batch = db.batch();
    for (const doc of chunk) batch.set(doc.ref, {
      status: "excluded",
      senderStatus: "excluded",
      senderExclusionReason: "apple-private-relay",
      senderGroupId: admin.firestore.FieldValue.delete(),
      senderRemovedAt: admin.firestore.FieldValue.serverTimestamp(),
      senderSyncError: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await batch.commit();
    removed += chunk.length;
  }
  console.log(JSON.stringify({ removed, failed: 0 }));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
