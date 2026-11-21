const { catalogRegion, route25BackendUrl, route25BackendHeaders } = require("./route25-backend");
const { readChineseCatalog } = require("./chinese-catalog");
const { canonicalCardSetId } = require("./card-set-id");
const { isPokemonTcgPocket } = require("./card-product");

const regions = ["international", "jp", "cn"];

async function fetchCatalog(region) {
  if (region === "cn") return (await readChineseCatalog("sets")).data;
  const setId = region === "jp" ? "catalog_ja" : "";
  const url = route25BackendUrl("/api/tcg/sets", setId);
  const response = await fetch(url, {
    headers: route25BackendHeaders(url, { accept: "application/json" })
  });
  if (!response.ok) throw new Error(`Set catalog returned ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

function normalizeSets(sets, region) {
  const unique = new Map();
  for (const set of sets) {
    if (!set?.id || !set?.name || isPokemonTcgPocket(set)) continue;
    const id = canonicalCardSetId(set.id);
    if (!id || catalogRegion(id) !== region) continue;
    unique.set(id.toLowerCase(), { ...set, id });
  }
  return [...unique.values()].sort((left, right) => {
    const dateOrder = String(right.releaseDate || "").localeCompare(String(left.releaseDate || ""));
    return dateOrder || String(left.name).localeCompare(String(right.name));
  });
}

async function loadSetCatalogs() {
  const names = ["English and international", "Japanese", "Simplified Chinese"];
  const results = await Promise.allSettled(regions.map(fetchCatalog));
  return regions.map((region, i) => ({
    region, name: names[i], unavailable: results[i].status === "rejected",
    sets: normalizeSets(results[i].status === "fulfilled" ? results[i].value : [], region)
  }));
}

module.exports = { loadSetCatalogs, normalizeSets, regions };
