const ROUTE25_ORIGIN = "https://route25.app";

function route25CardUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "route25.app" || !/^\/cards\/[^/]+\/?$/.test(url.pathname)) return "";
    return `${ROUTE25_ORIGIN}${url.pathname.replace(/\/$/, "")}${url.search}`;
  } catch {
    return "";
  }
}

module.exports = { route25CardUrl };
