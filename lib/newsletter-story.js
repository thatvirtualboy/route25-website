function plainText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const LEGACY_HEADINGS = new Map([
  ["the collection", "collectionFocus"],
  ["a favorite", "favorite"],
  ["the current chase", "currentChase"],
  ["the grail", "grail"]
]);
const LEGACY_SECTION = /<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>\s*<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;

function legacyCollectionFields(issue) {
  const fields = {};
  const body = String(issue?.bodyHtml || "");
  for (const match of body.matchAll(LEGACY_SECTION)) {
    const key = LEGACY_HEADINGS.get(plainText(match[1]).toLowerCase());
    if (key && !fields[key]) fields[key] = plainText(match[2]);
  }
  return fields;
}

function collectionStoryFields(issue) {
  const legacy = legacyCollectionFields(issue);
  return {
    collectionFocus: String(issue?.collectionFocus || legacy.collectionFocus || "").trim(),
    favorite: String(issue?.favorite || legacy.favorite || "").trim(),
    currentChase: String(issue?.currentChase || legacy.currentChase || "").trim(),
    grail: String(issue?.grail || legacy.grail || "").trim()
  };
}

function storyBodyHtml(issue) {
  let body = String(issue?.bodyHtml || "").trim();
  if (!body) return "";
  const firstParagraph = body.match(/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i);
  if (firstParagraph && plainText(firstParagraph[1]) === plainText(issue?.summary)) {
    body = body.slice(firstParagraph[0].length).trim();
  }
  if (legacyCollectionFields(issue).collectionFocus) {
    body = body.replace(LEGACY_SECTION, (section, heading) => LEGACY_HEADINGS.has(plainText(heading).toLowerCase()) ? "" : section).trim();
  }
  return body;
}

module.exports = { plainText, legacyCollectionFields, collectionStoryFields, storyBodyHtml };
