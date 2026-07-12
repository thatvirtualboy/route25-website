function senderRetryAction(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "sent") return "reconcile-published";
  if (["sending", "processing", "in_progress"].includes(normalized)) return "wait";
  return "send";
}

module.exports = { senderRetryAction };
