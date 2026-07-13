const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("production CSP allows Scrydex card images", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"),
  );
  const globalHeaders = config.headers.find((item) => item.source === "/(.*)");
  const csp = globalHeaders?.headers.find(
    (header) => header.key === "Content-Security-Policy",
  )?.value;

  assert.match(csp, /img-src[^;]*https:\/\/images\.scrydex\.com/);
});
