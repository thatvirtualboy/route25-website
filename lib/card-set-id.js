function canonicalCardSetId(value) {
  const id = String(value || "").trim();
  if (!id) return "";
  const svSubset = id.match(/^sv0*(\d+)\.(\d+)$/i);
  if (svSubset) return `sv${Number(svSubset[1])}pt${Number(svSubset[2])}`;
  const swshSubset = id.match(/^swsh0*(\d+)\.(\d+)$/i);
  if (swshSubset) return `swsh${Number(swshSubset[1])}pt${Number(swshSubset[2])}`;
  const svSet = id.match(/^sv0+(\d+)$/i);
  if (svSet) return `sv${Number(svSet[1])}`;
  return id;
}

function tcgdexCardSetId(value) {
  const id = canonicalCardSetId(value);
  const svSubset = id.match(/^sv(\d+)pt(\d+)$/i);
  if (svSubset) return `sv${svSubset[1].padStart(2, "0")}.${svSubset[2]}`;
  const swshSubset = id.match(/^swsh(\d+)pt(\d+)$/i);
  if (swshSubset) return `swsh${swshSubset[1]}.${swshSubset[2]}`;
  const svSet = id.match(/^sv(\d+)$/i);
  if (svSet) return `sv${svSet[1].padStart(2, "0")}`;
  return id;
}

function mapCardId(value, mapSetId) {
  const id = String(value || "").trim();
  const separator = id.lastIndexOf("-");
  if (separator < 1) return id;
  return `${mapSetId(id.slice(0, separator))}-${id.slice(separator + 1)}`;
}

function canonicalCardId(value) {
  return mapCardId(value, canonicalCardSetId);
}

function tcgdexCardId(value) {
  return mapCardId(value, tcgdexCardSetId);
}

module.exports = {
  canonicalCardId,
  canonicalCardSetId,
  tcgdexCardId,
  tcgdexCardSetId
};
