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
  const summary = shortText(issue?.dek || issue?.summary, 125);
  const issueNumber = Number(issue?.issueNumber) > 0 ? `ISSUE #${String(Number(issue.issueNumber)).padStart(3, "0")}` : "COLLECTOR STORY";
  const titleSize = title.length > 58 ? 48 : title.length > 38 ? 56 : 66;
  const image = assets.image || "";
  const icon = assets.icon || "";

  return h("div", {
    style: {
      width: "1200px",
      height: "630px",
      display: "flex",
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(135deg, #05060a 0%, #09111d 48%, #17102a 100%)",
      color: "#f7f8fc",
      fontFamily: FONT_FAMILY
    }
  },
    h("div", {
      style: {
        position: "absolute",
        inset: "0",
        background: "linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
        opacity: 0.38
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        left: "-150px",
        top: "-260px",
        width: "650px",
        height: "650px",
        borderRadius: "325px",
        background: "radial-gradient(circle, rgba(32,168,239,0.34), rgba(32,168,239,0) 68%)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        right: "-120px",
        bottom: "-260px",
        width: "690px",
        height: "690px",
        borderRadius: "345px",
        background: "radial-gradient(circle, rgba(141,99,255,0.34), rgba(141,99,255,0) 70%)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        right: "42px",
        top: "42px",
        width: "474px",
        height: "546px",
        display: "flex",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: "34px",
        background: "linear-gradient(145deg, rgba(32,168,239,0.25), rgba(141,99,255,0.22))",
        boxShadow: "0 36px 90px rgba(0,0,0,0.52)"
      }
    },
      image ? h("img", {
        src: image,
        width: 474,
        height: 546,
        style: { width: "474px", height: "546px", objectFit: "cover" }
      }) : h("div", {
        style: {
          width: "474px",
          height: "546px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #14263c, #251a46)"
        }
      }, icon ? h("img", { src: icon, width: 150, height: 150, style: { width: "150px", height: "150px", borderRadius: "34px" } }) : null),
      h("div", {
        style: {
          position: "absolute",
          inset: "0",
          background: "linear-gradient(180deg, transparent 48%, rgba(5,6,10,0.74) 100%)"
        }
      }),
      h("div", {
        style: {
          position: "absolute",
          left: "24px",
          right: "24px",
          bottom: "22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "rgba(255,255,255,0.92)",
          fontSize: "18px",
          fontWeight: 700
        }
      }, h("div", null, shortText(trainer, 28)), h("div", { style: { color: "#82ddff" } }, "route25.app"))
    ),
    h("div", {
      style: {
        position: "absolute",
        left: "58px",
        top: "52px",
        bottom: "48px",
        width: "594px",
        display: "flex",
        flexDirection: "column"
      }
    },
      h("div", {
        style: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "52px" }
      },
        icon ? h("img", { src: icon, width: 48, height: 48, style: { width: "48px", height: "48px", borderRadius: "13px" } }) : null,
        h("div", { style: { fontSize: "26px", fontWeight: 900, letterSpacing: "-0.5px" } }, "Route 25")
      ),
      h("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          color: "#65caff",
          fontSize: "16px",
          fontWeight: 900,
          letterSpacing: "2.6px"
        }
      },
        h("div", { style: { width: "42px", height: "3px", borderRadius: "2px", background: "linear-gradient(90deg, #20a8ef, #8d63ff)" } }),
        h("div", null, `${issueNumber}  ·  COLLECTOR SPOTLIGHT`)
      ),
      h("div", {
        style: {
          maxWidth: "590px",
          color: "#ffffff",
          fontSize: `${titleSize}px`,
          fontWeight: 900,
          lineHeight: 0.98,
          letterSpacing: "-2.6px"
        }
      }, shortText(title, 76)),
      summary ? h("div", {
        style: {
          maxWidth: "565px",
          marginTop: "24px",
          color: "rgba(231,236,244,0.76)",
          fontSize: "23px",
          fontWeight: 400,
          lineHeight: 1.36
        }
      }, summary) : null,
      h("div", {
        style: {
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          color: "rgba(255,255,255,0.9)",
          fontSize: "18px",
          fontWeight: 800
        }
      },
        h("div", {
          style: {
            display: "flex",
            padding: "9px 15px",
            border: "1px solid rgba(101,202,255,0.36)",
            borderRadius: "999px",
            background: "rgba(32,168,239,0.12)",
            color: "#bdeaff"
          }
        }, `Meet ${shortText(trainer, 32)}`),
        h("div", { style: { color: "rgba(255,255,255,0.45)" } }, "Every collector has a story.")
      )
    )
  );
}

module.exports = { FONT_FAMILY, renderNewsletterSocialCanvas };
