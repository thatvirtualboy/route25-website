function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function setYear() {
  const year = qs("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
}

function maybeShowSubscribedToast() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get("subscribed")) return;
  const toast = qs("#toast");
  if (!toast) return;

  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 4200);

  params.delete("subscribed");
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, "", next);
}

function wireFeatureStory() {
  const imgA = qs("#featurePhoneImgA");
  const imgB = qs("#featurePhoneImgB");
  const steps = qsa(".feature-step[data-screen]");
  if (!imgA || !imgB || steps.length === 0) return;

  let activeImg = imgA;
  let inactiveImg = imgB;
  let current = activeImg.getAttribute("src") || "";
  const reduceMotion = prefersReducedMotion();
  let loadToken = 0;

  function setScreen(src) {
    if (!src || src === current) return;
    current = src;

    const token = ++loadToken;
    const next = new Image();
    next.decoding = "async";
    next.onload = () => {
      if (token !== loadToken) return;

      if (reduceMotion) {
        activeImg.src = src;
        inactiveImg.src = src;
        return;
      }

      inactiveImg.src = src;
      inactiveImg.classList.add("active");
      activeImg.classList.remove("active");
      const tmp = activeImg;
      activeImg = inactiveImg;
      inactiveImg = tmp;
    };
    next.src = src;
  }

  function pickActiveStep() {
    const target = window.innerHeight * 0.33;
    let best = steps[0];
    let bestDist = Number.POSITIVE_INFINITY;

    for (const step of steps) {
      const rect = step.getBoundingClientRect();
      if (rect.top <= target && rect.bottom >= target) return step;
      const dist = Math.min(Math.abs(rect.top - target), Math.abs(rect.bottom - target));
      if (dist < bestDist) {
        bestDist = dist;
        best = step;
      }
    }

    return best;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      const step = pickActiveStep();
      setScreen(step.getAttribute("data-screen"));
    });
  }

  // Initialize.
  inactiveImg.classList.remove("active");
  activeImg.classList.add("active");
  setScreen(steps[0].getAttribute("data-screen"));
  onScroll();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
}

function wireReveal() {
  const items = qsa("[data-reveal]");
  if (items.length === 0 || prefersReducedMotion()) {
    for (const el of items) el.classList.add("revealed");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -12% 0px" }
  );

  for (const el of items) observer.observe(el);
}

function wireGalleryControls() {
  const track = qs("[data-gallery-track]");
  if (!track) return;

  function scrollByDirection(dir) {
    const first = track.querySelector(":scope > *");
    const step = first ? first.getBoundingClientRect().width + 16 : 260;
    track.scrollBy({ left: dir * step, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  const prev = qs("[data-gallery-prev]");
  const next = qs("[data-gallery-next]");
  if (prev) prev.addEventListener("click", () => scrollByDirection(-1));
  if (next) next.addEventListener("click", () => scrollByDirection(1));
}

setYear();
wireReveal();
wireFeatureStory();
wireGalleryControls();
maybeShowSubscribedToast();
