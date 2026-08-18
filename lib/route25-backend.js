const DEFAULT_BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";

function normalizeBackendOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : "";
  } catch {
    return "";
  }
}

function route25BackendOrigin() {
  return normalizeBackendOrigin(process.env.ROUTE25_BACKEND_ORIGIN) || DEFAULT_BACKEND_ORIGIN;
}

function isJapaneseSetId(setId) {
  return /_ja$/i.test(String(setId || "").trim());
}

function route25BackendUrl(path, setId, params = {}) {
  const url = new URL(path, route25BackendOrigin());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  if (isJapaneseSetId(setId)) url.searchParams.set("region", "jp");
  return url.href;
}

function route25BackendHeaders(url, headers = {}) {
  const output = { ...headers };
  try {
    if (new URL(url).origin !== route25BackendOrigin()) return output;
  } catch {
    return output;
  }

  const bypass = String(process.env.ROUTE25_VERCEL_BYPASS_SECRET || "").trim();
  if (bypass) output["x-vercel-protection-bypass"] = bypass;
  return output;
}

module.exports = {
  BACKEND_ORIGIN: route25BackendOrigin(),
  DEFAULT_BACKEND_ORIGIN,
  isJapaneseSetId,
  normalizeBackendOrigin,
  route25BackendHeaders,
  route25BackendOrigin,
  route25BackendUrl
};
