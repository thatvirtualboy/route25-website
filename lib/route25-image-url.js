const { DEFAULT_BACKEND_ORIGIN, route25BackendOrigin } = require("./route25-backend");

function route25ImageUrl(value, backendOrigin = route25BackendOrigin()) {
  if (!value) return "";

  try {
    const backend = new URL(backendOrigin);
    const image = new URL(value, backend);
    if (image.origin !== backend.origin) return image.href;

    const suffix = `${image.pathname}${image.search}${image.hash}`;
    if (
      image.pathname.startsWith("/api/proxy/")
      || image.pathname.startsWith("/api/__proxy/")
      || image.pathname.startsWith("/card-images/")
    ) {
      return suffix;
    }

    return `/api/__proxy${suffix}`;
  } catch {
    return "";
  }
}

module.exports = {
  DEFAULT_BACKEND_ORIGIN,
  route25ImageUrl
};
