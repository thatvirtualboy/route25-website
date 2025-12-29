const { Readable } = require("node:stream");

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function normalizeBackendOrigin(origin) {
  if (!origin) return null;
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) return null;
  return trimmed;
}

function getPathSegments(pathQuery) {
  if (Array.isArray(pathQuery)) return pathQuery.filter(Boolean);
  if (typeof pathQuery === "string" && pathQuery) return [pathQuery];
  return [];
}

function appendQueryParams(url, query) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, String(v));
    } else if (typeof value !== "undefined") {
      search.append(key, String(value));
    }
  }
  const queryString = search.toString();
  if (queryString) url.search = queryString;
}

function getRequestHeaders(req) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === "host") continue;
    if (lower === "content-length") continue;
    if (lower === "accept-encoding") continue;
    headers[key] = value;
  }
  if (req.headers?.host) headers["x-forwarded-host"] = req.headers.host;
  headers["x-forwarded-proto"] = "https";
  return headers;
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function setResponseHeaders(res, upstreamHeaders, backendOrigin) {
  for (const [key, value] of upstreamHeaders.entries()) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === "content-length") continue;
    if (lower === "set-cookie") continue;

    if (lower === "location" && value && value.startsWith(backendOrigin)) {
      res.setHeader(key, value.slice(backendOrigin.length) || "/");
      continue;
    }

    if (typeof value !== "undefined") res.setHeader(key, value);
  }

  if (typeof upstreamHeaders.getSetCookie === "function") {
    const cookies = upstreamHeaders.getSetCookie();
    if (cookies?.length) res.setHeader("set-cookie", cookies);
    return;
  }

  const singleCookie = upstreamHeaders.get("set-cookie");
  if (singleCookie) res.setHeader("set-cookie", singleCookie);
}

module.exports = async (req, res) => {
  const backendOrigin = normalizeBackendOrigin(process.env.ROUTE25_BACKEND_ORIGIN) || "https://palettetown-backend.vercel.app";
  if (!backendOrigin) {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Missing ROUTE25_BACKEND_ORIGIN (e.g. https://your-backend.vercel.app)");
    return;
  }

  const pathSegments = getPathSegments(req.query?.path);
  const upstreamUrl = new URL(backendOrigin);
  upstreamUrl.pathname = `/${pathSegments.join("/")}`;
  appendQueryParams(upstreamUrl, req.query);

  const method = (req.method || "GET").toUpperCase();
  const headers = getRequestHeaders(req);
  const init = { method, headers, redirect: "manual" };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await readRequestBody(req);
  }

  const upstreamRes = await fetch(upstreamUrl, init);
  res.statusCode = upstreamRes.status;
  setResponseHeaders(res, upstreamRes.headers, backendOrigin);

  if (upstreamRes.body && typeof Readable.fromWeb === "function") {
    Readable.fromWeb(upstreamRes.body).pipe(res);
    return;
  }

  const buffer = Buffer.from(await upstreamRes.arrayBuffer());
  res.setHeader("content-length", String(buffer.length));
  res.end(buffer);
};

