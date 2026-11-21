const fs = require("node:fs");
const path = require("node:path");
const { renderSiteHeader } = require("../lib/site-header");

const pages = [
  "index.html", "privacy.html", "terms.html", "404.html", "open/index.html",
  "trainer/index.html", "elite-trainers/index.html", "newsletter/index.html",
  "newsletter/issue.html", "newsletter/submit.html", "newsletter/subscribe.html",
  "newsletter/privacy.html", "giveaways/index.html", "embed/index.html"
];

function syncHeaders(check = false) {
  for (const page of pages) {
    const filename = path.join(__dirname, "..", page);
    const source = fs.readFileSync(filename, "utf8");
    const active = page.startsWith("newsletter/") ? "spotlights" : page.startsWith("giveaways/") ? "giveaways" : "";
    const next = source.replace(/<!-- site-header:start -->[\s\S]*?<!-- site-header:end -->/,
      `<!-- site-header:start -->\n${renderSiteHeader(active)}\n<!-- site-header:end -->`);
    if (next === source && !source.includes('class="site-header"')) throw new Error(`Missing header marker: ${page}`);
    if (check && next !== source) throw new Error(`Run npm run sync:headers to update ${page}`);
    if (!check && next !== source) fs.writeFileSync(filename, next);
  }
}

if (require.main === module) syncHeaders(process.argv.includes("--check"));
module.exports = { pages, syncHeaders };
