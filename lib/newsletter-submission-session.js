const crypto = require("node:crypto");

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_UPLOADS = 15;

function sessionId() { return crypto.randomUUID(); }
function sessionExpiry(now = Date.now()) { return new Date(now + SESSION_TTL_MS); }
function sessionIsUsable(data, ipHash, now = Date.now()) {
  const expiresAt = data?.expiresAt?.toDate?.() || data?.expiresAt;
  return Boolean(data && data.ipHash === ipHash && data.consumed !== true && new Date(expiresAt).getTime() > now);
}

module.exports = { SESSION_TTL_MS, MAX_UPLOADS, sessionId, sessionExpiry, sessionIsUsable };
