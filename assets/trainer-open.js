// Preserve the mobile handoff for a shared trainer profile.
if (/iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent) && !document.hidden) {
  const link = document.getElementById("open-trainer");
  const timer = setTimeout(() => location.assign(link.href), 400);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer);
  });
}
