const SENDER_PREHEADER_MAX = 255;

function senderSubject(issue) {
  const title = String(issue?.title || "").trim();
  const issueNumber = Number(issue?.issueNumber);
  if (!Number.isInteger(issueNumber) || issueNumber < 1) return title;
  return `${String(issueNumber).padStart(3, "0")} - ${title}`;
}

function senderPreheader(issue) {
  const source = String(issue?.dek || issue?.summary || "").trim();
  return Array.from(source).slice(0, SENDER_PREHEADER_MAX).join("");
}

module.exports = { SENDER_PREHEADER_MAX, senderSubject, senderPreheader };
