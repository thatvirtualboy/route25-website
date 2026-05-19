const React = require("react");
const { readFileSync } = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  BACKEND_ORIGIN,
  absoluteUrlForSocial,
  fetchCardForSocial,
  formatCardNumberForSocial
} = require("./[id].js");

const FONT_FAMILY = "Geist Sans";
let fontCache = null;
const imageCache = new Map();
const FONT_FILES = [
  { file: "geist-sans-latin-400-normal.woff", weight: 400 },
  { file: "geist-sans-latin-700-normal.woff", weight: 700 },
  { file: "geist-sans-latin-900-normal.woff", weight: 900 }
];

function h(type, props, ...children) {
  return React.createElement(type, props || null, ...children.filter((child) => child !== null && child !== undefined && child !== ""));
}

function text(value, fallback = "") {
  return String(value || fallback).trim();
}

function shortText(value, maxLength) {
  const clean = text(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function cardImage(card) {
  return absoluteUrlForSocial(card?.images?.large || card?.images?.small, BACKEND_ORIGIN);
}

function setLogo(card) {
  return absoluteUrlForSocial(card?.set?.images?.localLogo || card?.set?.images?.logo, BACKEND_ORIGIN);
}

async function imageDataUrl(url) {
  const source = text(url);
  if (!source) return "";
  if (source.startsWith("data:")) return source;
  if (imageCache.has(source)) return imageCache.get(source);

  const response = await fetch(source, { headers: { accept: "image/png,image/jpeg,image/webp,*/*" } });
  if (!response.ok) {
    throw new Error(`Image fetch failed ${response.status} for ${source}`);
  }

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const input = Buffer.from(await response.arrayBuffer());
  const output = contentType.includes("png") || contentType.includes("jpeg") || contentType.includes("jpg")
    ? input
    : await sharp(input).png().toBuffer();
  const mime = contentType.includes("jpeg") || contentType.includes("jpg") ? "image/jpeg" : "image/png";
  const dataUrl = `data:${mime};base64,${output.toString("base64")}`;
  imageCache.set(source, dataUrl);
  return dataUrl;
}

function requestOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "route25.app";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

function localFontBuffer(file) {
  const buffer = readFileSync(path.join(process.cwd(), "assets", "fonts", file));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function remoteFontBuffer(origin, file) {
  const response = await fetch(`${origin}/assets/fonts/${file}`);
  if (!response.ok) {
    throw new Error(`Font fetch failed ${response.status} for ${file}`);
  }
  return response.arrayBuffer();
}

async function fontData(req, file) {
  const origin = requestOrigin(req);
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return localFontBuffer(file);
  }
  try {
    return await remoteFontBuffer(origin, file);
  } catch {
    return localFontBuffer(file);
  }
}

async function socialFonts(req) {
  if (!fontCache) {
    const loaded = await Promise.all(FONT_FILES.map(async ({ file, weight }) => ({
      name: FONT_FAMILY,
      data: await fontData(req, file),
      weight,
      style: "normal"
    })));
    fontCache = loaded;
  }
  return fontCache;
}

function renderSocialCanvas(card, assets = {}) {
  const image = assets.image || cardImage(card);
  const logo = assets.logo || setLogo(card);
  const setName = text(card?.set?.name || card?.set?.id, "Pokemon TCG");
  const number = formatCardNumberForSocial(card) || card?.number || "";
  const cardMeta = [
    card?.rarity,
    number ? `Card ${number}` : null,
    Array.isArray(card?.types) ? card.types.join(" / ") : null
  ].filter(Boolean).join("  |  ");

  return h("div", {
    style: {
      width: "1200px",
      height: "630px",
      display: "flex",
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(135deg, #05060a 0%, #090d18 44%, #141026 100%)",
      color: "white",
      fontFamily: FONT_FAMILY
    }
  },
    h("div", {
      style: {
        position: "absolute",
        inset: "0",
        background: "linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
        backgroundSize: "54px 54px",
        opacity: 0.42
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        left: "-130px",
        top: "-170px",
        width: "620px",
        height: "920px",
        background: "linear-gradient(155deg, rgba(88, 199, 255, 0.2), rgba(111, 125, 255, 0.04))",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        transform: "rotate(-18deg)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        right: "-210px",
        top: "-120px",
        width: "610px",
        height: "860px",
        background: "linear-gradient(155deg, rgba(255, 214, 82, 0.16), rgba(138, 93, 255, 0.08))",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        transform: "rotate(24deg)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        left: "430px",
        top: "72px",
        width: "2px",
        height: "500px",
        background: "linear-gradient(180deg, transparent, rgba(88, 199, 255, 0.48), transparent)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        left: "0",
        bottom: "0",
        width: "1200px",
        height: "190px",
        background: "linear-gradient(0deg, rgba(5, 6, 10, 0.7), transparent)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        left: "64px",
        top: "54px",
        right: "64px",
        bottom: "54px",
        display: "flex",
        alignItems: "center",
        gap: "64px"
      }
    },
      h("div", {
        style: {
          width: "360px",
          height: "502px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "30px",
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          boxShadow: "0 34px 80px rgba(0, 0, 0, 0.46)"
        }
      },
        h("img", {
          src: image,
          width: 336,
          height: 468,
          style: {
            width: "336px",
            height: "468px",
            objectFit: "contain",
            borderRadius: "18px"
          }
        })
      ),
      h("div", {
        style: {
          flex: "1",
          minWidth: "0",
          display: "flex",
          flexDirection: "column"
        }
      },
        h("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "18px",
            marginBottom: "26px"
          }
        },
          logo ? h("img", {
            src: logo,
            style: {
              maxWidth: "190px",
              maxHeight: "70px",
              objectFit: "contain"
            }
          }) : null,
          h("div", {
            style: {
            display: "flex",
            flexDirection: "column",
            gap: "4px"
            }
          },
            h("div", {
              style: {
                fontSize: "23px",
                fontWeight: 900,
                color: "rgba(255, 255, 255, 0.88)"
              }
            }, shortText(setName, 36)),
            h("div", {
              style: {
                fontSize: "18px",
                fontWeight: 700,
                color: "#7cd8ff"
              }
            }, "Route 25")
          )
        ),
        h("div", {
          style: {
            fontSize: "74px",
            lineHeight: 0.94,
            fontWeight: 900,
            letterSpacing: "0px",
            maxWidth: "610px",
            marginBottom: "24px"
          }
        }, shortText(card?.name, 34)),
        h("div", {
          style: {
            fontSize: "27px",
            lineHeight: 1.28,
            fontWeight: 700,
            color: "rgba(255, 255, 255, 0.76)",
            maxWidth: "610px"
          }
        }, shortText(cardMeta, 72)),
        h("div", {
          style: {
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "25px",
            fontWeight: 900,
            color: "#ffd652"
          }
        },
          h("img", {
            src: "https://route25.app/assets/Icon.png",
            width: 48,
            height: 48,
            style: {
              width: "48px",
              height: "48px",
              borderRadius: "10px"
            }
          }),
          h("div", null, "Track, share, and trade Pokemon cards")
        )
      )
    )
  );
}

module.exports = async (req, res) => {
  const cardId = text(req.query?.id);
  if (!cardId) {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Card not found");
    return;
  }

  try {
    const timings = [];
    const card = await fetchCardForSocial(cardId, timings);
    if (!card) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.setHeader("server-timing", timings.join(", "));
      res.end("Card not found");
      return;
    }

    const [resolvedImage, resolvedLogo] = await Promise.all([
      imageDataUrl(cardImage(card)).catch(() => cardImage(card)),
      imageDataUrl(setLogo(card)).catch(() => setLogo(card))
    ]);
    const { ImageResponse } = await import("@vercel/og");
    const image = new ImageResponse(renderSocialCanvas(card, {
      image: resolvedImage,
      logo: resolvedLogo
    }), {
      width: 1200,
      height: 630,
      fonts: await socialFonts(req)
    });
    const arrayBuffer = await image.arrayBuffer();

    res.statusCode = 200;
    res.setHeader("content-type", "image/png");
    res.setHeader("server-timing", timings.join(", "));
    res.setHeader("cache-control", "public, max-age=0, must-revalidate");
    res.setHeader("cdn-cache-control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("vercel-cdn-cache-control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Could not render social image");
  }
};
