const SENDER_PREHEADER_MAX = 255;

function senderPreheader(issue) {
  const source = String(issue?.dek || issue?.summary || "").trim();
  return Array.from(source).slice(0, SENDER_PREHEADER_MAX).join("");
}

module.exports = { SENDER_PREHEADER_MAX, senderPreheader };
