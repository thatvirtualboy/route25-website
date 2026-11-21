const { DEFAULT_BACKEND_ORIGIN } = require("./route25-backend");

const PROJECT = "palettetown-5064b";
const SOURCE = '<small>Chinese catalog data adapted from <a href="https://github.com/cardcorpus/pokemon-card-dataset">CardCorpus</a> under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</small>';
let session;
let pending;

async function signIn() {
  const admin = require("firebase-admin");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!admin.apps.length) {
    admin.initializeApp({ credential: raw ? admin.credential.cert(JSON.parse(raw)) : admin.credential.applicationDefault() });
  }
  const options = { redirect: "error", signal: AbortSignal.timeout(6000) };
  const configResponse = await fetch(DEFAULT_BACKEND_ORIGIN + "/api/web/firebase-config", options);
  if (!configResponse.ok) throw new Error("Catalog sign-in configuration unavailable");
  const { config } = await configResponse.json();
  if (config?.projectId !== PROJECT || !config.apiKey) throw new Error("Invalid catalog sign-in configuration");
  const token = await admin.auth().createCustomToken("route25-website-catalog-reader");
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=" + encodeURIComponent(config.apiKey), {
    ...options, method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, returnSecureToken: true })
  });
  if (!response.ok) throw new Error("Catalog sign-in unavailable");
  const { idToken, expiresIn } = await response.json();
  if (!idToken || !(Number(expiresIn) > 60)) throw new Error("Invalid catalog session");
  session = { token: idToken, expires: Date.now() + (Number(expiresIn) - 60) * 1000 };
  return session;
}

async function readChineseCatalog(op, params = {}) {
  const url = new URL("/api/cn-pilot", DEFAULT_BACKEND_ORIGIN);
  url.search = new URLSearchParams({ ...params, op, edition: "cn-v1" });
  if (!session || session.expires <= Date.now()) {
    pending ??= signIn().finally(() => { pending = null; });
    await pending;
  }
  const current = session;
  const response = await fetch(url.href, {
    headers: { authorization: "Bearer " + current.token }, redirect: "error", signal: AbortSignal.timeout(8000)
  });
  if (response.status === 404 && op === "card") return { data: null };
  if (!response.ok) {
    if (response.status === 401 && current === session) session = null;
    throw new Error("Chinese catalog returned " + response.status);
  }
  return response.json();
}

module.exports = { readChineseCatalog, SOURCE };
