const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("production CSP allows every card-image provider", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"),
  );
  const globalHeaders = config.headers.find((item) => item.source === "/(.*)");
  const csp = globalHeaders?.headers.find(
    (header) => header.key === "Content-Security-Policy",
  )?.value;

  const requiredImageSources = [
    "https://images.scrydex.com",
    "https://images.pokemontcg.io",
    "https://tcgplayer-cdn.tcgplayer.com",
    "https://static.tcgcollector.com",
    "https://firebasestorage.googleapis.com",
    "https://*.googleusercontent.com",
  ];

  const imagePolicy = csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("img-src "));

  for (const source of requiredImageSources) {
    assert.ok(
      imagePolicy.split(/\s+/).includes(source),
      `img-src must allow ${source}`,
    );
  }
});
