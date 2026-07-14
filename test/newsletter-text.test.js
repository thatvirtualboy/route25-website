const test = require("node:test");
const assert = require("node:assert/strict");
const { plainTextParagraphs } = require("../lib/newsletter-text");

test("structured newsletter text retains paragraphs and intentional line breaks", () => {
  assert.deepEqual(
    plainTextParagraphs("First line\ncontinued line\n\nSecond paragraph\r\n\r\nThird paragraph"),
    ["First line\ncontinued line", "Second paragraph", "Third paragraph"]
  );
});

test("structured newsletter text drops empty surrounding whitespace", () => {
  assert.deepEqual(plainTextParagraphs("\n\n  A paragraph  \n\n\n"), ["A paragraph"]);
});
