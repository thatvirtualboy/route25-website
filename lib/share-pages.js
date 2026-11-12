const { Buffer } = require("node:buffer");

const shareAssets = `<link rel="stylesheet" href="/assets/public.css">
    <link rel="stylesheet" href="/assets/share.css">
    <script defer src="/assets/public.js"></script>`;

const shareNav = `<header class="topbar"><div class="topbar-inner">
  <a class="brand" href="/"><img src="/apple-touch-icon.png" width="30" height="30" alt="">Route 25</a>
  <nav class="nav" aria-label="Primary"><a href="/search">Search cards</a><a href="/sets">Browse sets</a><a href="/newsletter">Collector Spotlights</a><a href="/#download" class="nav-download">Get the app ↗</a></nav>
</div></header>`;

function shareKind(pathname) {
  return /^\/(collection|folders|trade|post)(?:\/[^/]+)?\/?$/.exec(pathname)?.[1] || "";
}

// The share service owns the markup and interactive data. Attach the website's
// theme to its document shell, then stream even very large binders untouched.
async function* themedShareStream(body, kind) {
  let prefix = Buffer.alloc(0);
  let streaming = false;
  for await (const chunk of body) {
    if (streaming) {
      yield chunk;
      continue;
    }
    prefix = Buffer.concat([prefix, chunk]);
    const index = prefix.indexOf("<body>");
    if (index >= 0) {
      const head = prefix.subarray(0, index).toString("utf8");
      if (head.includes("</head>")) {
        yield head.replace("</head>", shareAssets + "</head>");
        yield `<body class="public-page share-page share-${kind}">` + (kind === "trade" ? shareNav : "");
        yield prefix.subarray(index + 6);
      } else {
        yield prefix;
      }
    } else if (prefix.length > 128 * 1024) {
      yield prefix;
    } else {
      continue;
    }
    prefix = Buffer.alloc(0);
    streaming = true;
  }
  if (prefix.length) yield prefix;
}

function unavailableShare(kind) {
  const title = {collection: "Collection unavailable", folders: "Folder unavailable", trade: "Trade unavailable", post: "Post unavailable"}[kind];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Route 25</title>${shareAssets}</head><body class="public-page share-page">${shareNav}<main class="share-message"><h1>${title}</h1><p>Check the original share link or ask the trainer for a new one.</p><a class="button primary" href="/">Route 25 home</a></main></body></html>`;
}

module.exports = { shareAssets, shareNav, shareKind, themedShareStream, unavailableShare };
