const DEFAULT_BACKEND_ORIGIN = "https://palettetown-backend.vercel.app";

function route25ImageUrl(value, backendOrigin = DEFAULT_BACKEND_ORIGIN) {
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
