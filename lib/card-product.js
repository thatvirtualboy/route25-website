function normalizedText(value) {
  let text = String(value || "").trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Keep malformed provider URLs inspectable as plain text.
  }
  return text.toLowerCase();
}

function isPokemonTcgPocketSetId(value) {
  return /^(?:[a-z]\d+[a-z]?|p-[a-z])$/i.test(String(value || "").trim());
}

function isPokemonTcgPocketCardId(value) {
  const id = String(value || "").trim();
  const setId = id.replace(/-[^-]+$/, "");
  return Boolean(setId && setId !== id && isPokemonTcgPocketSetId(setId));
}

function hasPocketMarker(value) {
  const text = normalizedText(value);
  return text === "tcgp"
    || text === "tcg pocket"
    || /pok[eé]mon\s+tcg\s+pocket/i.test(text)
    || /(?:^|\/)tcgp(?:\/|$)/i.test(text);
}

function isPokemonTcgPocket(record) {
  if (!record || typeof record !== "object") return false;
  if (isPokemonTcgPocketCardId(record.id)) return true;

  const set = record.set && typeof record.set === "object" ? record.set : {};
  if (isPokemonTcgPocketSetId(record.id) && (record.cardCount || record.cards || record.serie || record.series)) return true;
  if (isPokemonTcgPocketSetId(set.id)) return true;

  const markers = [
    record.serie,
    record.serie?.id,
    record.serie?.name,
    record.series,
    record.series?.id,
    record.series?.name,
    set.serie,
    set.serie?.id,
    set.serie?.name,
    set.series,
    set.series?.id,
    set.series?.name,
    record.image,
    record.images?.small,
    record.images?.large,
    record.logo,
    record.symbol,
    set.logo,
    set.symbol,
    set.images?.logo,
    set.images?.symbol,
    set.images?.small,
    set.images?.large
  ];
  return markers.some(hasPocketMarker);
}

module.exports = {
  isPokemonTcgPocket,
  isPokemonTcgPocketCardId,
  isPokemonTcgPocketSetId
};
