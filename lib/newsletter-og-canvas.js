const React = require("react");

const FONT_FAMILY = "Geist Sans";

function h(type, props, ...children) {
  return React.createElement(type, props || null, ...children.filter(child => child !== null && child !== undefined && child !== ""));
}

function cleanText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function shortText(value, maxLength) {
  const clean = cleanText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function renderNewsletterSocialCanvas(issue, assets = {}) {
  const title = cleanText(issue?.title, "A Route 25 collector story");
  const trainer = cleanText(issue?.trainerName, "Featured collector");
  const issueNumber = Number(issue?.issueNumber) > 0 ? `ISSUE #${String(Number(issue.issueNumber)).padStart(3, "0")}` : "COLLECTOR STORY";
  const titleSize = title.length > 58 ? 52 : title.length > 38 ? 60 : 74;
  const image = assets.image || "";
  const icon = assets.icon || "";

  return h("div", {
    style: {
      width: "1200px",
      height: "630px",
      display: "flex",
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(135deg, #07111f 0%, #17102a 100%)",
      color: "#f7f8fc",
      fontFamily: FONT_FAMILY
    }
  },
    image ? h("img", {
      src: image,
      width: 1200,
      height: 630,
      style: { position: "absolute", inset: "0", width: "1200px", height: "630px", objectFit: "cover" }
    }) : h("div", {
      style: {
        position: "absolute",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 74% 34%, rgba(141,99,255,0.54), transparent 34%), radial-gradient(circle at 30% 78%, rgba(32,168,239,0.42), transparent 38%), #07111f"
      }
    }, icon ? h("img", { src: icon, width: 190, height: 190, style: { width: "190px", height: "190px", borderRadius: "42px", opacity: 0.7 } }) : null),
    h("div", {
      style: {
        position: "absolute",
        inset: "0",
        background: "linear-gradient(90deg, rgba(3,7,14,0.94) 0%, rgba(3,7,14,0.82) 34%, rgba(3,7,14,0.42) 60%, rgba(3,7,14,0.08) 100%)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        inset: "0",
        background: "linear-gradient(0deg, rgba(3,6,12,0.92) 0%, rgba(3,6,12,0.26) 46%, rgba(3,6,12,0.12) 72%, rgba(3,6,12,0.46) 100%)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        inset: "24px",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "28px"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        left: "54px",
        top: "46px",
        right: "54px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }
    },
      h("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "13px",
          padding: "9px 14px 9px 10px",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "16px",
          background: "rgba(3,7,14,0.58)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.34)"
        }
      },
        icon ? h("img", { src: icon, width: 42, height: 42, style: { width: "42px", height: "42px", borderRadius: "11px" } }) : null,
        h("div", { style: { fontSize: "24px", fontWeight: 900, letterSpacing: "-0.5px", textShadow: "0 2px 10px rgba(0,0,0,0.8)" } }, "Route 25")
      ),
      h("div", {
        style: {
          display: "flex",
          padding: "10px 15px",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "999px",
          background: "rgba(3,7,14,0.58)",
          color: "#aee9ff",
          fontSize: "14px",
          fontWeight: 900,
          letterSpacing: "2px",
          textShadow: "0 2px 10px rgba(0,0,0,0.85)"
        }
      }, `${issueNumber}  ·  COLLECTOR SPOTLIGHT`)
    ),
    h("div", {
      style: {
        position: "absolute",
        left: "58px",
        right: "58px",
        bottom: "48px",
        display: "flex",
        flexDirection: "column"
      }
    },
      h("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" } },
        h("div", { style: { width: "46px", height: "4px", borderRadius: "2px", background: "linear-gradient(90deg, #20a8ef, #8d63ff)", boxShadow: "0 2px 12px rgba(32,168,239,0.7)" } }),
        h("div", { style: { color: "#bdeaff", fontSize: "16px", fontWeight: 900, letterSpacing: "2.4px", textShadow: "0 2px 14px rgba(0,0,0,0.95)" } }, `FEATURING ${shortText(trainer, 34).toUpperCase()}`)
      ),
      h("div", {
        style: {
          maxWidth: "920px",
          color: "#ffffff",
          fontSize: `${titleSize}px`,
          fontWeight: 900,
          lineHeight: 0.96,
          letterSpacing: "-2.8px",
          textShadow: "0 4px 24px rgba(0,0,0,0.96), 0 1px 3px rgba(0,0,0,1)"
        }
      }, shortText(title, 78)),
      h("div", {
        style: {
          marginTop: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "rgba(255,255,255,0.78)",
          fontSize: "17px",
          fontWeight: 800,
          textShadow: "0 2px 12px rgba(0,0,0,0.95)"
        }
      },
        h("div", null, "Every collector has a story."),
        h("div", { style: { color: "#aee9ff", fontWeight: 900 } }, "route25.app")
      )
    )
  );
}

module.exports = { FONT_FAMILY, renderNewsletterSocialCanvas };
