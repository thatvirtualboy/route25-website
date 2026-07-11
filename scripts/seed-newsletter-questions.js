const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
admin.initializeApp({ credential: raw ? admin.credential.cert(JSON.parse(raw)) : admin.credential.applicationDefault() });
const questions = [
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
const db = process.env.FIRESTORE_DATABASE_ID ? getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID) : getFirestore(admin.app()), batch = db.batch();
for (const [id, text, category] of questions) batch.set(db.collection("newsletterQuestions").doc(id), { text, category, active: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
batch.commit().then(() => { console.log(`Seeded ${questions.length} newsletter questions.`); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
