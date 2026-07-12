function normalizeTrainerId(value) {
  const trainerId = typeof value === "string" ? value.trim().slice(0, 128) : "";
  return /^[A-Za-z0-9_-]{3,128}$/.test(trainerId) ? trainerId : "";
}

function trainerProfileUrl(value, site = "https://route25.app") {
  const trainerId = normalizeTrainerId(value);
  return trainerId ? `${String(site).replace(/\/$/, "")}/trainer/${encodeURIComponent(trainerId)}` : "";
}

module.exports = { normalizeTrainerId, trainerProfileUrl };
