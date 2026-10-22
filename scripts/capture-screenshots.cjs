// Optional documentation helper. Install Playwright separately or set PLAYWRIGHT_MODULE_PATH.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const fs = require("node:fs");
const path = require("node:path");

async function capture() {
  const output = path.join(__dirname, "..", "docs", "screenshots");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const base = process.env.SCREENSHOT_URL || "http://127.0.0.1:3000";
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base, { waitUntil: "load", timeout: 60000 });
    await page.waitForFunction(() => document.querySelector(".main").swiper && document.fonts.status === "loaded");
    await page.screenshot({ path: path.join(output, "01-opening.jpg"), type: "jpeg", quality: 88 });
    await page.mouse.wheel(0, 200);
    await page.waitForSelector(".intro-slide", { state: "detached" });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".header")).opacity === "1");
    await page.screenshot({ path: path.join(output, "02-home.jpg"), type: "jpeg", quality: 88 });
    await page.evaluate(() => document.querySelector(".main").swiper.slideTo(2, 0));
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    await page.waitForFunction(() => {
      const image = document.querySelector(".main > .swiper-wrapper > .swiper-slide-active .image img");
      return image && image.complete && image.naturalWidth > 0;
    });
    await page.screenshot({ path: path.join(output, "03-project-gallery.jpg"), type: "jpeg", quality: 88 });
    await page.evaluate(() => { const swiper = document.querySelector(".main").swiper; swiper.slideTo(swiper.slides.length - 1, 0); });
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    await page.screenshot({ path: path.join(output, "04-contact.jpg"), type: "jpeg", quality: 88 });

    // Hide real requests in this isolated browser context; no customer records are captured.
    await page.route("**/api/inquiries", route => route.fulfill({ json: [] }));
    const credentials = {};
    for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line);
      if (match) credentials[match[1]] = match[2];
    }
    const login = await context.request.post(`${base}/api/login`, {
      data: { username: credentials.ADMIN_USERNAME, password: credentials.ADMIN_PASSWORD },
    });
    if (!login.ok()) throw new Error("Admin login failed; no private data captured.");
    await page.goto(`${base}/admin`, { waitUntil: "load" });
    await page.waitForSelector("#panel:not(.hidden)");
    await page.screenshot({ path: path.join(output, "05-admin.jpg"), type: "jpeg", quality: 88 });
    await page.getByRole("button", { name: /İstekler/ }).click();
    await page.screenshot({ path: path.join(output, "06-inquiries.jpg"), type: "jpeg", quality: 88 });
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    console.log("Six screenshots created; private inquiries excluded. No browser JavaScript errors.");
  } finally {
    await browser.close();
  }
}

capture().catch(error => { console.error(error.message); process.exitCode = 1; });
