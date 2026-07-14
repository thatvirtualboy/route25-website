function plainTextParagraphs(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

module.exports = { plainTextParagraphs };
