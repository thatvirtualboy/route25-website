const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const backendOrigin = "https://palettetown-backend.vercel.app";
const searchPage = require(path.join(root, "api/card-search.js"));
const searchData = require(path.join(root, "api/card-search-data.js"));
const cardPage = require(path.join(root, "api/cards.js"));
const setPage = require(path.join(root, "api/sets.js"));
const sitemapCards = require(path.join(root, "api/sitemap-cards.js"));
const sitemapSets = require(path.join(root, "api/sitemap-sets.js"));

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
  for (const header of ["cache-control", "content-length", "content-type", "etag", "last-modified"]) {
    const value = response.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

function serveStatic(pathname, res) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath)) {
    return false;
  }
  if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  res.statusCode = 200;
  res.setHeader("content-type", mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function createLocalServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1:3000"}`);
    req.query = Object.fromEntries(url.searchParams.entries());

    try {
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
      if (url.pathname === "/sitemap-cards.xml") {
        await sitemapCards(req, res);
        return;
      }
      if (url.pathname === "/sitemap-sets.xml") {
        await sitemapSets(req, res);
        return;
      }
      if (url.pathname.startsWith("/api/proxy/") || url.pathname.startsWith("/api/__proxy/") || url.pathname.startsWith("/card-images/")) {
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
  proxyTargetUrl
};
