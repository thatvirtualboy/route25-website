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

function storyBodyHtml(issue) {
  let body = String(issue?.bodyHtml || "").trim();
  if (!body) return "";
  const firstParagraph = body.match(/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i);
  if (firstParagraph && plainText(firstParagraph[1]) === plainText(issue?.summary)) {
    body = body.slice(firstParagraph[0].length).trim();
  }
  return body;
}

module.exports = { plainText, storyBodyHtml };
