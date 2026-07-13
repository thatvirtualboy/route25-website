const NETWORKS = [
  { domains: ["x.com", "twitter.com"], label: "Twitter (X)", displayHost: "x.com" },
  { domains: ["instagram.com"], label: "Instagram" },
  { domains: ["youtube.com", "youtu.be"], label: "YouTube" },
  { domains: ["tiktok.com"], label: "TikTok" },
  { domains: ["threads.net"], label: "Threads" },
  { domains: ["bsky.app"], label: "Bluesky" },
  { domains: ["facebook.com", "fb.com"], label: "Facebook" },
  { domains: ["twitch.tv"], label: "Twitch" },
  { domains: ["reddit.com"], label: "Reddit" },
  { domains: ["linkedin.com"], label: "LinkedIn" },
  { domains: ["pinterest.com"], label: "Pinterest" },
  { domains: ["discord.com", "discord.gg"], label: "Discord" },
  { domains: ["linktr.ee"], label: "Linktree" },
  { domains: ["tumblr.com"], label: "Tumblr" },
  { domains: ["snapchat.com"], label: "Snapchat" },
  { domains: ["mastodon.social"], label: "Mastodon" }
];

function matchesDomain(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function socialDetails(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return { label: "Social profile", displayUrl: "View profile" };
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const network = NETWORKS.find(item => item.domains.some(domain => matchesDomain(host, domain)));
    let path = parsed.pathname.replace(/\/+$/, "");
    try { path = decodeURIComponent(path); } catch { /* Preserve a malformed but displayable path. */ }
    return {
      label: network?.label || "Social profile",
      displayUrl: `${network?.displayHost || host}${path}`
    };
  } catch {
    return { label: "Social profile", displayUrl: "View profile" };
  }
}

module.exports = { NETWORKS, socialDetails };
