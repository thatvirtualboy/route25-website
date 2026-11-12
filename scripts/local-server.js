const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const backendOrigin = "https://palettetown-backend.vercel.app";
const searchPage = require(path.join(root, "api/card-search.js"));
const searchData = require(path.join(root, "api/card-search-data.js"));
const setDirectory = require(path.join(root, "api/set-directory.js"));
const cardPage = require(path.join(root, "api/cards.js"));
const setPage = require(path.join(root, "api/sets.js"));
const sitemapCards = require(path.join(root, "api/sitemap-cards.js"));
const sitemapSets = require(path.join(root, "api/sitemap-sets.js"));

const backendProxy = require("../api/backend-proxy");
const trainerProfile = require("../api/trainer-profile");
const { shareKind } = require("../lib/share-pages");
const embed = require(path.join(root, "api/embed.js"));
const defaultCsp = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")).headers.flatMap(rule => rule.headers).find(header => header.key === "Content-Security-Policy").value;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

function proxyTargetUrl(pathname, search = "") {
  const targetPath = pathname.startsWith("/api/__proxy/")
    ? pathname.slice("/api/__proxy".length)
    : pathname;
  return `${backendOrigin}${targetPath}${search}`;
}

async function proxyBackend(pathname, search, res) {
  const response = await fetch(proxyTargetUrl(pathname, search));
  res.statusCode = response.status;
  for (const header of ["cache-control", "content-type", "etag", "last-modified"]) {
    const value = response.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

function publicNewsletterUrl(method, params) {
  const action = params.get("action");
  if (method !== "GET" || !["issues", "issue", "questions", "public-config"].includes(action)) return null;
  const target = new URL("https://route25.app/api/newsletter");
  target.searchParams.set("action", action);
  if (action === "issue") target.searchParams.set("slug", params.get("slug") || "");
  return target.toString();
}

function serveStatic(pathname, res, statusCode = 200) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath)) {
    return false;
  }
  if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  res.statusCode = statusCode;
  res.setHeader("content-type", mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function createLocalServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1:3000"}`);
    req.query = Object.fromEntries(url.searchParams.entries());

    try {
      res.setHeader("Content-Security-Policy", defaultCsp);
      if (url.pathname === "/web/styles.css") {
        serveStatic("/assets/web-client.css", res);
        return;
      }
      // Only the signed-out shell and public assets are needed for local review.
      const webPreview = {
        "/login": "/login", "/login/": "/login", "/web": "/web", "/web/": "/web",
        "/web/base.css": "/web/styles.css", "/web/app.js": "/web/app.js",
        "/web/professor-rak.png": "/web/professor-rak.png", "/api/web/firebase-config": "/api/web/firebase-config",
      };
      if (Object.hasOwn(webPreview, url.pathname)) {
        if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405, { Allow: "GET, HEAD" }).end(); return; }
        await proxyBackend(webPreview[url.pathname], "", res);
        return;
      }
      const trainer = /^\/trainer\/([^/]+)\/?$/.exec(url.pathname);
      if (trainer) {
        req.query.id = decodeURIComponent(trainer[1]);
        await trainerProfile(req, res);
        return;
      }
      if (shareKind(url.pathname)) {
        if (!["GET", "HEAD"].includes(req.method)) {
          res.writeHead(405, { Allow: "GET, HEAD" }).end();
          return;
        }
        // Production share HTML uses absolute Route 25 image URLs.
        res.setHeader("Content-Security-Policy", defaultCsp.replace("img-src 'self'", "img-src 'self' https://route25.app"));
        await backendProxy({
          method: req.method,
          headers: { accept: req.headers.accept, "user-agent": req.headers["user-agent"] },
          query: { ...req.query, path: url.pathname.slice(1) },
        }, res);
        return;
      }
      const embedMatch = url.pathname.match(/^\/embed\/(trainer|collection)\/([A-Za-z0-9_-]+)\/?$/);
      if (embedMatch) {
        req.query.kind = embedMatch[1]; req.query.id = embedMatch[2];
        await embed(req, res);
        return;
      }
      if (url.pathname === "/index.html") {
        res.statusCode = 308;
        res.setHeader("location", "/");
        res.end();
        return;
      }
      if (url.pathname === "/search" || url.pathname === "/search/") {
        await searchPage(req, res);
        return;
      }
      if (url.pathname === "/api/card-search") {
        await searchData(req, res);
        return;
      }
      if (url.pathname === "/api/newsletter") {
        // Local previews read public stories only; forms cannot write to production.
        const target = publicNewsletterUrl(req.method, url.searchParams);
        if (!target) {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Newsletter submissions are disabled in the local preview." }));
          return;
        }
        const response = await fetch(target);
        res.statusCode = response.status;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(await response.text());
        return;
      }
      if (/^\/newsletter\/(submit|subscribe|privacy)\/?$/.test(url.pathname)) {
        serveStatic(`${url.pathname.replace(/\/$/, "")}.html`, res);
        return;
      }
      if (/^\/newsletter\/[^/.]+\/?$/.test(url.pathname) && !/^\/newsletter\/(admin|preview)\/?$/.test(url.pathname)) {
        serveStatic("/newsletter/issue.html", res);
        return;
      }
      if (url.pathname === "/sets" || url.pathname === "/sets/") {
        await setDirectory(req, res);
        return;
      }
      if (url.pathname === "/sitemap-cards.xml") {
        await sitemapCards(req, res);
        return;
      }
      if (url.pathname === "/sitemap-sets.xml") {
        await sitemapSets(req, res);
        return;
      }
      if (url.pathname.startsWith("/api/proxy/") || url.pathname.startsWith("/api/__proxy/") || url.pathname.startsWith("/card-images/") || url.pathname.startsWith("/set-logos/") || url.pathname.startsWith("/trainer-avatars/")) {
        await proxyBackend(url.pathname, url.search, res);
        return;
      }
      const cardMatch = url.pathname.match(/^\/cards\/([^/]+)\/?$/);
      if (cardMatch) {
        req.query.id = decodeURIComponent(cardMatch[1]);
        await cardPage(req, res);
        return;
      }
      const setMatch = url.pathname.match(/^\/sets\/([^/]+)\/?$/);
      if (setMatch) {
        req.query.id = decodeURIComponent(setMatch[1]);
        await setPage(req, res);
        return;
      }
      if (serveStatic(url.pathname, res)) return;
      if (serveStatic("/404.html", res, 404)) return;
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("Not found");
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; charset=utf-8");
      }
      res.end("Local server error");
    }
  });
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  createLocalServer().listen(port, "127.0.0.1", () => {
    console.log(`Route 25 local server ready at http://127.0.0.1:${port}/search`);
  });
}

module.exports = {
  createLocalServer,
  proxyTargetUrl,
  publicNewsletterUrl
};
