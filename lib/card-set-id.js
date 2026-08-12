function canonicalCardSetId(value) {
  const id = String(value || "").trim();
  if (!id) return "";
  const meSubset = id.match(/^me0*(\d+)\.(\d+)$/i);
  if (meSubset) return `me${Number(meSubset[1])}pt${Number(meSubset[2])}`;
  const svSubset = id.match(/^sv0*(\d+)\.(\d+)$/i);
  if (svSubset) return `sv${Number(svSubset[1])}pt${Number(svSubset[2])}`;
  const swshSubset = id.match(/^swsh0*(\d+)\.(\d+)$/i);
  if (swshSubset) return `swsh${Number(swshSubset[1])}pt${Number(swshSubset[2])}`;
  const meSet = id.match(/^me0+(\d+)$/i);
  if (meSet) return `me${Number(meSet[1])}`;
  const svSet = id.match(/^sv0+(\d+)$/i);
  if (svSet) return `sv${Number(svSet[1])}`;
  return id;
}

function tcgdexCardSetId(value) {
  const id = canonicalCardSetId(value);
  const meSubset = id.match(/^me(\d+)pt(\d+)$/i);
  if (meSubset) return `me${meSubset[1].padStart(2, "0")}.${meSubset[2]}`;
  const svSubset = id.match(/^sv(\d+)pt(\d+)$/i);
  if (svSubset) return `sv${svSubset[1].padStart(2, "0")}.${svSubset[2]}`;
  const swshSubset = id.match(/^swsh(\d+)pt(\d+)$/i);
  if (swshSubset) return `swsh${swshSubset[1]}.${swshSubset[2]}`;
  const meSet = id.match(/^me(\d+)$/i);
  if (meSet) return `me${meSet[1].padStart(2, "0")}`;
  const svSet = id.match(/^sv(\d+)$/i);
  if (svSet) return `sv${svSet[1].padStart(2, "0")}`;
  return id;
}

function canonicalCardNumber(value, setId = "") {
  const number = String(value || "").trim();
  const canonicalSetId = canonicalCardSetId(setId);
  if (!/^\d+$/.test(number) || !/^(?:sv|swsh|me\d)/i.test(canonicalSetId)) return number;
  return String(Number.parseInt(number, 10));
}

function mapCardId(value, mapSetId) {
  const id = String(value || "").trim();
  const separator = id.lastIndexOf("-");
  if (separator < 1) return id;
  const sourceSetId = id.slice(0, separator);
  return `${mapSetId(sourceSetId)}-${canonicalCardNumber(id.slice(separator + 1), sourceSetId)}`;
}

function canonicalCardId(value) {
  return mapCardId(value, canonicalCardSetId);
}

function tcgdexCardId(value) {
  const canonicalId = canonicalCardId(value);
  const separator = canonicalId.lastIndexOf("-");
  if (separator < 1) return canonicalId;
  const setId = canonicalId.slice(0, separator);
  const number = canonicalId.slice(separator + 1);
  const providerNumber = /^\d+$/.test(number) && /^(?:sv|swsh|me\d)/i.test(setId)
    ? number.padStart(3, "0")
    : number;
  return `${tcgdexCardSetId(setId)}-${providerNumber}`;
}

module.exports = {
  canonicalCardId,
  canonicalCardNumber,
  canonicalCardSetId,
  tcgdexCardId,
  tcgdexCardSetId
};
