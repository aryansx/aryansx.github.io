(() => {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const revealTargets = [...document.querySelectorAll("[data-reveal]")];
  const cards = [...document.querySelectorAll("[data-interactive]")];
  const navLinks = [...document.querySelectorAll("nav a[href^='#']")];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute("href")));
  const hero = document.querySelector(".hero");
  const progress = document.querySelector(".scroll-progress");
  const toggle = document.querySelector(".motion-toggle");
  let paused = false;
  let observer;
  let scrollFrame = 0;
  let pointerFrame = 0;
  let latestPointer;

  const canAnimate = () => !reducedMotion.matches && !paused;

  function reveal(element) {
    element.classList.remove("reveal-pending");
    observer?.unobserve(element);
  }

  function resetPointers() {
    hero.style.removeProperty("--hero-x");
    hero.style.removeProperty("--hero-y");
    cards.forEach(card => {
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
    });
    latestPointer = null;
    if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
  }

  function configureMotion() {
    observer?.disconnect();
    revealTargets.forEach(element => element.classList.remove("reveal-pending"));
    resetPointers();
    const enabled = canAnimate();
    root.classList.toggle("motion-ready", enabled);
    root.classList.toggle("motion-off", !enabled);
    toggle.hidden = reducedMotion.matches;
    toggle.setAttribute("aria-pressed", String(paused));

    if (!enabled || !("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) reveal(entry.target);
      });
    }, { threshold: 0, rootMargin: "0px 0px -32px 0px" });

    revealTargets.forEach(element => {
      // Anything already on screen stays visible, including deep-link targets.
      if (element.getBoundingClientRect().top >= window.innerHeight) {
        element.classList.add("reveal-pending");
        observer.observe(element);
      }
    });
  }

  function updateScroll() {
    scrollFrame = 0;
    const scrollable = Math.max(0, root.scrollHeight - window.innerHeight);
    const fraction = scrollable ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    progress.style.transform = `scaleX(${fraction})`;
    let active = -1;
    sections.forEach((section, index) => {
      if (section && section.getBoundingClientRect().top <= window.innerHeight * .35) active = index;
    });
    if (fraction >= .99 && window.scrollY > 0) active = sections.length - 1;
    navLinks.forEach((link, index) => {
      if (index === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll);
  }

  function updatePointer() {
    pointerFrame = 0;
    if (!latestPointer || !canAnimate() || !finePointer.matches) return;
    const { element, x, y } = latestPointer;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const horizontal = Math.max(-.5, Math.min(.5, (x - bounds.left) / bounds.width - .5));
    const vertical = Math.max(-.5, Math.min(.5, (y - bounds.top) / bounds.height - .5));
    if (element === hero) {
      hero.style.setProperty("--hero-x", `${horizontal * 16}px`);
      hero.style.setProperty("--hero-y", `${vertical * 16}px`);
    } else {
      element.style.setProperty("--tilt-x", `${vertical * -3}deg`);
      element.style.setProperty("--tilt-y", `${horizontal * 3}deg`);
    }
  }

  [hero, ...cards].forEach(element => {
    element.addEventListener("pointermove", event => {
      if (!canAnimate() || !finePointer.matches) return;
      latestPointer = { element, x: event.clientX, y: event.clientY };
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(updatePointer);
    }, { passive: true });
    element.addEventListener("pointerleave", resetPointers);
  });

  toggle.addEventListener("click", () => {
    paused = !paused;
    configureMotion();
  });
  document.addEventListener("focusin", event => {
    // Keyboard navigation must never land in an invisible section.
    const target = event.target.closest?.("[data-reveal]");
    if (target) reveal(target);
  });
  document.querySelectorAll("a[href^='#']").forEach(link => {
    link.addEventListener("click", () => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      revealTargets.forEach(element => {
        if (target === element || target.contains(element)) reveal(element);
      });
    });
  });
  reducedMotion.addEventListener("change", configureMotion);
  finePointer.addEventListener("change", resetPointers);
  window.addEventListener("scroll", scheduleScroll, { passive: true });
  window.addEventListener("resize", scheduleScroll, { passive: true });
  window.addEventListener("hashchange", scheduleScroll);
  window.addEventListener("pageshow", scheduleScroll);

  try {
    configureMotion();
    updateScroll();
  } catch (error) {
    // Animation enhancement can fail without hiding the portfolio.
    observer?.disconnect();
    root.classList.remove("motion-ready");
    root.classList.add("motion-off");
    revealTargets.forEach(element => element.classList.remove("reveal-pending"));
    toggle.hidden = true;
    console.warn("Motion enhancement unavailable", error);
  }
})();
