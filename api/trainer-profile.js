const embeds = require("../lib/embeds");
const { shareAssets, shareNav } = require("../lib/share-pages");

const store = "https://apps.apple.com/us/app/route-25-tcg-social-network/id6755665546";
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function profileDocument(id, trainer) {
  const url = "https://route25.app/trainer/" + encodeURIComponent(id);
  const deepLink = "route25://trainer/" + encodeURIComponent(id);
  const name = trainer?.displayName || "Trainer ID";
  const title = trainer ? name + " · Route 25 Trainer" : "Route 25 Trainer • " + id;
  const description = "Jump into Route 25 to explore this trainer’s pulls, trades, and binder stats.";
  const image = embeds.safeImage(trainer?.avatarURL);
  const stats = trainer ? [
    [trainer.ownedCardCount, "Cards collected"], [trainer.followers, "Followers"], [trainer.completedTradeCount, "Completed trades"],
  ].map(([value, label]) => `<div class="stat"><b>${Number(value).toLocaleString("en-US")}</b><span>${label}</span></div>`).join("") : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(title)}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}">
    <meta name="apple-itunes-app" content="app-id=6755665546, app-argument=${deepLink}">
    <meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:type" content="profile">
    <meta property="og:image" content="${image ? escape(image) : "https://route25.app/apple-touch-icon.png"}"><meta name="twitter:card" content="summary">
    ${shareAssets}<script src="/assets/trainer-open.js" defer></script></head>
    <body class="public-page share-page share-trainer">${shareNav}<main class="profile">
      <header class="profile-identity">
        <div class="profile-portrait">${image ? `<img src="${escape(image)}" alt="" width="144" height="144">` : '<img src="/apple-touch-icon.png" alt="" width="84" height="84">'}</div>
        <p class="eyebrow">Route 25 Trainer</p><h1>${escape(name)}</h1>
        ${trainer?.level ? `<p class="profile-level">Level ${Number(trainer.level)} trainer</p>` : ""}
        <p class="trainer-id">${trainer ? "Trainer ID · " : ""}${escape(id)}</p>
      </header>
      ${stats ? `<section class="stats" aria-label="Trainer statistics">${stats}</section>` : ""}
      <p class="meta">${description}</p><div class="actions"><a class="button primary" id="open-trainer" href="${deepLink}">Open in Route 25</a><a class="button secondary" href="${store}">Get the app</a></div>
    </main></body></html>`;
}

function createHandler(loadTrainer = embeds.loadTrainer) {
  return async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.setHeader("Allow", "GET, HEAD"); res.statusCode = 405; res.end(); return;
    }
    const opts = embeds.options({ kind: "trainer", id: req.query?.id });
    if (!opts) { res.statusCode = 400; res.end("Invalid trainer ID"); return; }
    let trainer;
    try {
      trainer = await loadTrainer(opts.id);
    } catch {
      // Keep the app handoff available when the public profile read fails.
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", trainer ? "public, max-age=60, s-maxage=300" : "no-store");
    res.end(req.method === "HEAD" ? undefined : profileDocument(opts.id, trainer));
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
