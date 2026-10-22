const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function createOpening(reducedMotion = false) {
  let now = 0;
  let removed = false;
  const events = new Map();
  const overlayEvents = new Map();
  const timers = [];
  const state = { wheel: true, keyboard: true };
  const title = {
    style: {},
    querySelector: () => ({ firstChild: {} }),
    getBoundingClientRect: () => ({ left: 50, top: 200 }),
  };
  const hint = { setAttribute() {}, addEventListener() {} };
  const overlay = {
    style: {}, classList: { toggle() {}, add() {} }, setAttribute() {},
    querySelector: selector => selector === ".intro-title" ? title : hint,
    addEventListener: (name, handler) => overlayEvents.set(name, handler),
    remove: () => { removed = true; },
  };
  const main = {
    activeIndex: 1, translate: -900, allowTouchMove: true,
    mousewheel: { disable() { state.wheel = false; }, enable() { state.wheel = true; } },
    keyboard: { disable() { state.keyboard = false; }, enable() { state.keyboard = true; } },
  };
  const context = vm.createContext({
    window: {
      innerWidth: 1440, innerHeight: 900,
      matchMedia: () => ({ matches: reducedMotion }),
      addEventListener: (name, handler) => events.set(name, handler),
      removeEventListener: name => events.delete(name),
    },
    document: {
      body: { classList: { remove() {} } },
      createRange: () => ({ setStart() {}, setEnd() {}, getBoundingClientRect: () => ({ left: 400, top: 200, width: 100, height: 180 }) }),
    },
    performance: { now: () => now },
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "intro-transition.js"), "utf8"), context);
  context.setupLagomIntro(main, overlay);
  return {
    title, main, state, events, timers,
    wheel(time, deltaY = 100) {
      now = time;
      events.get("wheel")({ deltaY, preventDefault() {}, stopImmediatePropagation() {} });
    },
    touch(time, start, end) {
      now = time;
      overlayEvents.get("touchstart")({ touches: [{ clientY: start }] });
      overlayEvents.get("touchend")({ changedTouches: [{ clientY: end }] });
    },
    finish: () => timers.forEach(timer => timer.callback()),
    removed: () => removed,
  };
}

test("one scroll starts an automatic centered zoom and restores navigation after completion", () => {
  const opening = createOpening();
  assert.equal(opening.state.wheel, false);
  opening.wheel(0);
  assert.equal(opening.title.style.animation, "intro-enter-zoom 4200ms linear forwards");
  assert.equal(opening.title.style.transformOrigin, "50% 50%");
  assert.equal(opening.removed(), false);
  assert.equal(opening.timers[0].delay, 4300);
  assert.equal(opening.main.translate, -900);
  assert.equal(opening.main.activeIndex, 1);
  opening.finish();
  assert.equal(opening.removed(), true);
  assert.equal(opening.state.wheel, true);
  assert.equal(opening.state.keyboard, true);
  assert.equal(opening.main.allowTouchMove, true);
  assert.equal(opening.events.has("wheel"), false);
});

test("repeated scrolling does not restart the animation or skip ahead", () => {
  const opening = createOpening();
  for (let time = 0; time < 1800; time += 50) opening.wheel(time);
  assert.equal(opening.timers.length, 1);
  assert.equal(opening.removed(), false);
});

test("upward input does not start the opening; one upward finger swipe does", () => {
  const opening = createOpening();
  opening.wheel(0, -100);
  assert.equal(opening.timers.length, 0);
  opening.touch(1600, 500, 300);
  assert.equal(opening.timers.length, 1);
  assert.equal(opening.main.translate, -900);
});

test("reduced motion uses a short fade without the large zoom", () => {
  const opening = createOpening(true);
  opening.wheel(0);
  assert.equal(opening.title.style.animation, undefined);
  assert.equal(opening.timers[0].delay, 200);
  opening.finish();
  assert.equal(opening.state.wheel, true);
});
