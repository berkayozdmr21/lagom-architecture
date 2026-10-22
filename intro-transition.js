// One gesture starts the complete opening while the home page stays still.
function setupLagomIntro(main, overlay) {
  const title = overlay.querySelector(".intro-title");
  const hint = overlay.querySelector(".intro-scroll");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ending = false;
  let touchY = null;

  main.mousewheel.disable();
  main.keyboard.disable();
  main.allowTouchMove = false;
  overlay.setAttribute("role", "region");
  hint.setAttribute("role", "button");
  hint.setAttribute("tabindex", "0");
  hint.setAttribute("aria-label", "Yazıya yaklaş ve ana sayfaya gir");

  function enterHome() {
    if (ending) return;
    ending = true;
    title.style.transformOrigin = "50% 50%";
    if (!reducedMotion) title.style.animation = "intro-enter-zoom 4200ms linear forwards";
    overlay.classList.add("zoomed");
    overlay.classList.add("entering");
    if (reducedMotion) overlay.style.transition = "opacity 180ms ease";
    // Wait for the zoom and fade before restoring normal gallery navigation.
    setTimeout(() => {
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("keydown", onKey, true);
      overlay.remove();
      document.body.classList.remove("intro-active");
      main.allowTouchMove = true;
      main.mousewheel.enable();
      main.keyboard.enable();
      main.allowSlidePrev = false;
    }, reducedMotion ? 200 : 4300);
  }

  function onWheel(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.deltaY > 2) enterHome();
  }

  function onKey(event) {
    const forward = ["ArrowDown", "PageDown", " ", "Enter"].includes(event.key);
    const backward = ["ArrowUp", "PageUp"].includes(event.key);
    if (!forward && !backward) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (forward && !event.repeat) enterHome();
  }

  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  window.addEventListener("keydown", onKey, true);
  overlay.addEventListener("touchstart", event => {
    touchY = event.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener("touchmove", event => event.preventDefault(), { passive: false });
  overlay.addEventListener("touchend", event => {
    if (touchY === null) return;
    const distance = touchY - event.changedTouches[0].clientY;
    touchY = null;
    if (distance > 35) enterHome();
  });
  hint.addEventListener("click", enterHome);
}
