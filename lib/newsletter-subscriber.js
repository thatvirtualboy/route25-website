const PRIVATE_RELAY_DOMAINS = new Set(["privaterelay.appleid.com"]);

function isPrivateRelayEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim().toLowerCase();
  const separator = email.lastIndexOf("@");
  return separator > 0 && PRIVATE_RELAY_DOMAINS.has(email.slice(separator + 1));
}

module.exports = { isPrivateRelayEmail };
