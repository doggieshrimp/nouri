// Generates Google Play store graphics from the running dev server:
//   store-listing/screenshots/*.png  phone screenshots with captions (1080 × 1920)
//   store-listing/feature-graphic.png (1024 × 500)
//   store-listing/icon-512.png
// Usage: start `npm run dev`, then `npm run store-shots`.
// Uses headless Microsoft Edge (or Chrome via the BROWSER env var) over the DevTools protocol.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173/";
const BROWSER = process.env.BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "store-listing");
const RAW = join(OUT, "raw");
const SHOTS = join(OUT, "screenshots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- DevTools protocol plumbing ----------

class Page {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      const waiter = msg.id && this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error.message));
      else waiter.resolve(msg.result);
    };
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval(body) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression: `(async () => { ${body} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }
  async waitFor(condition, what, timeout = 20000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await this.eval(`return !!(${condition});`).catch(() => false)) return;
      await sleep(200);
    }
    throw new Error(`Timed out waiting for ${what}`);
  }
  async goto(url) {
    await this.send("Page.navigate", { url });
    await sleep(300);
    await this.waitFor(`document.readyState === "complete"`, "page load");
    await this.eval(`await document.fonts.ready;`);
  }
  async setViewport(width, height, deviceScaleFactor, mobile) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile });
  }
  async screenshot(file) {
    await sleep(400); // let transitions settle
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(file, Buffer.from(data, "base64"));
    console.log("  saved", file.replace(ROOT, "."));
  }
}

async function launchBrowser() {
  const profile = mkdtempSync(join(tmpdir(), "nouri-shots-"));
  const proc = spawn(
    BROWSER,
    ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 75; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const target = targets.find((t) => t.type === "page");
      if (target) {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)));
        const page = new Page(ws);
        await page.send("Page.enable");
        const close = async () => {
          ws.close();
          proc.kill();
          await sleep(500);
          rmSync(profile, { recursive: true, force: true });
        };
        return { page, close };
      }
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  proc.kill();
  throw new Error(`Couldn't start the browser at ${BROWSER}`);
}

// ---------- In-page helpers for driving the app ----------

const HELPERS = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel) => document.querySelector(sel);
  const byText = (text, tag = "*") =>
    [...document.querySelectorAll(tag)].find((el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === text.toLowerCase());
  const type = (el, value) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  };
  const scrollToEl = (el, offset = 12) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
`;

// A realistic day: real USDA and Open Food Facts values, logged through the app's own code.
const SEED = `
  const db = await import("/src/db.ts");
  const n = await import("/src/lib/nutrition.ts");
  const { todayKey } = await import("/src/lib/dates.ts");
  const { FOOD_DB } = await import("/src/data/foods.ts");
  const { searchUsda } = await import("/src/lib/usda.ts");
  const { lookupBarcode } = await import("/src/lib/openFoodFacts.ts");

  await db.db.entries.clear();
  await db.db.meals.clear();
  await db.db.settings.clear();
  await db.setGoal(1900);

  const local = (name) => FOOD_DB.find((f) => f.name === name);
  const crumpets = (await lookupBarcode("5010044000701")).food;
  const tortilla = (await searchUsda("tortilla flour")).generic.find((f) => f.name === "Tortilla, flour");
  if (!crumpets || !tortilla) throw new Error("Couldn't fetch demo foods");

  const day = todayKey();
  const log = async (food, grams) => {
    await db.addEntry(day, { name: n.entryName(food, grams), ...n.scaleFood(food, grams), food, grams });
    await new Promise((r) => setTimeout(r, 5));
  };
  await log(crumpets, 110);
  await log(local("Butter"), 10);
  await log(local("Greek yogurt, plain nonfat"), 150);
  await log(local("Banana"), 120);
  await log(tortilla, 64);
  await log(local("Chicken breast, raw"), 120);
  await log(local("Avocado"), 50);
  await log(local("Spinach, raw"), 30);
  await db.addEntry(day, { name: "Coffee with milk", calories: 40, protein: 2, carbs: 3, fat: 2, sugars: 3, saturatedFat: 1.2 });

  const entries = await db.getEntriesForDate(day);
  await db.saveMeal("Usual breakfast", entries.slice(0, 3));
  await db.saveMeal("Chicken wrap", entries.slice(4, 8));
  return entries.length;
`;

const scenes = [
  {
    file: "01-home.png",
    caption: "Track calories without the clutter",
    sub: "Free. No adverts. No account.",
    run: `window.scrollTo(0, 0);`,
  },
  {
    file: "02-search.png",
    caption: "Search thousands of foods",
    sub: "From basic foods to supermarket brands",
    run: `
      type($('[aria-label="Search foods"]'), "tortilla");
      await sleep(600);
      for (let i = 0; i < 60 && !(byText("Basic foods") && !$('[aria-label="Searching"]')); i++) await sleep(250);
      document.activeElement?.blur();
      scrollToEl(byText("Add food"));
    `,
  },
  {
    file: "03-barcode.png",
    caption: "Scan a barcode, log a serving",
    sub: "Label serving sizes filled in for you",
    run: `
      $('[aria-label="Enter a barcode"]').click();
      await sleep(200);
      const input = $('[aria-label="Barcode number"]');
      type(input, "5010044000701");
      input.form.requestSubmit();
      for (let i = 0; i < 60 && !byText("1 crumpet · 55 g"); i++) await sleep(250);
      byText("1 crumpet · 55 g").click();
      await sleep(200);
      document.activeElement?.blur();
      scrollToEl(byText("Add food"));
    `,
  },
  {
    file: "04-meals.png",
    caption: "Log your usual meals in one tap",
    sub: "Saved meals and recent foods",
    run: `scrollToEl(byText("Add food"));`,
  },
  {
    file: "05-goal.png",
    caption: "Find a daily goal that suits you",
    sub: "From your height, weight, age and activity",
    run: `
      $('[aria-label="Calculate a suggested goal"]').click();
      await sleep(200);
      type($('[aria-label="Age"]'), "34");
      type($('[aria-label="Weight in kilograms"]'), "82");
      type($('[aria-label="Height in centimetres"]'), "175");
      [...document.querySelectorAll('input[name="activity"]')][2].click();
      await sleep(300);
      // From the age field down to the suggested goal.
      scrollToEl(byText("Age"), 8);
    `,
  },
  {
    file: "06-reading.png",
    caption: "Easy to read, your way",
    sub: "Dyslexia-friendly fonts, colours and spacing",
    appearance: { background: "yellow", font: "atkinson", textSize: 1.125, extraSpacing: false, plainText: true },
    run: `
      $('[aria-label="Display and reading settings"]').click();
      await sleep(300);
      window.scrollTo(0, 0);
    `,
  },
];

// ---------- Captioned frames ----------

function frameHtml({ image, caption, sub, fontUrl }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: "Open Sans"; src: url("${fontUrl}") format("woff2"); font-weight: 300 800; }
    html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; }
    body { background: #FAF8F3; color: #1A1A1A; font-family: "Open Sans", sans-serif; }
    /* Fixed height so the rule and phone line up across all screenshots, whatever the caption length. */
    .top { padding: 96px 90px 0; height: 250px; }
    h1 { font-size: 76px; line-height: 1.08; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
    p { font-size: 40px; line-height: 1.3; color: #7A5C2E; font-weight: 600; margin: 22px 0 0; }
    .rule { height: 14px; background: #1A1A1A; margin: 44px 90px 0; }
    .phone { margin: 72px auto 0; width: 800px; height: 1422px;
             border: 8px solid #1A1A1A; border-bottom: 0; overflow: hidden; background: #FAF8F3; }
    .phone img { width: 100%; display: block; }
  </style></head><body>
    <div class="top"><h1>${caption}</h1><p>${sub}</p></div>
    <div class="rule"></div>
    <div class="phone"><img src="${image}"></div>
  </body></html>`;
}

function featureHtml({ image, fontUrl, iconUrl }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: "Open Sans"; src: url("${fontUrl}") format("woff2"); font-weight: 300 800; }
    html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; }
    body { background: #FAF8F3; color: #1A1A1A; font-family: "Open Sans", sans-serif; position: relative; }
    .text { position: absolute; left: 64px; top: 86px; width: 520px; }
    .brand { display: flex; align-items: center; gap: 18px; }
    .brand img { width: 108px; height: 108px; margin-left: -14px; }
    h1 { font-size: 108px; font-weight: 800; letter-spacing: -0.03em; margin: 0; line-height: 1; }
    .rule { height: 12px; background: #1A1A1A; margin: 26px 0 24px; width: 460px; }
    p { font-size: 34px; line-height: 1.25; font-weight: 700; margin: 0; }
    p span { color: #7A5C2E; }
    .phone { position: absolute; right: 64px; top: 48px; width: 300px; height: 452px; border: 6px solid #1A1A1A;
             border-bottom: 0; overflow: hidden; }
    .phone img { width: 100%; display: block; }
  </style></head><body>
    <div class="text">
      <div class="brand"><img src="${iconUrl}"><h1>Nouri</h1></div>
      <div class="rule"></div>
      <p>Free calorie tracking.<br><span>No adverts. No account.</span></p>
    </div>
    <div class="phone"><img src="${image}"></div>
  </body></html>`;
}

// ---------- Main ----------

async function main() {
  for (const dir of [RAW, SHOTS]) mkdirSync(dir, { recursive: true });
  const fontUrl = pathToFileURL(
    join(ROOT, "node_modules/@fontsource-variable/open-sans/files/open-sans-latin-wght-normal.woff2"),
  ).href;
  const iconFile = join(OUT, "icon-512.png");
  await sharp(join(ROOT, "assets/icon-only.png")).resize(512, 512).png().toFile(iconFile);
  console.log("  saved ./store-listing/icon-512.png");

  const { page, close } = await launchBrowser();
  try {
    // App screens at a 360 × 640 phone viewport, 3× → 1080 × 1920.
    await page.setViewport(360, 640, 3, true);
    await page.send("Emulation.setLocaleOverride", { locale: "en-GB" });
    await page.goto(APP_URL);
    console.log("Seeding demo data…");
    await page.eval(`localStorage.clear(); ${SEED}`);

    for (const scene of scenes) {
      console.log(scene.file);
      const appearance = scene.appearance ? JSON.stringify(JSON.stringify(scene.appearance)) : null;
      await page.eval(
        appearance ? `localStorage.setItem("daily-log:appearance", ${appearance});` : `localStorage.removeItem("daily-log:appearance");`,
      );
      await page.goto(APP_URL);
      await page.waitFor(`document.querySelector('[aria-label="Search foods"]') && document.body.innerText.includes("Coffee with milk")`, "app with demo data");
      await page.eval(`${HELPERS} ${scene.run}`);
      await page.screenshot(join(RAW, scene.file));
    }
    await page.eval(`localStorage.removeItem("daily-log:appearance");`);

    // Captioned frames and the feature graphic.
    const scratch = mkdtempSync(join(tmpdir(), "nouri-frames-"));
    await page.setViewport(1080, 1920, 1, false);
    for (const scene of scenes) {
      const html = join(scratch, `${scene.file}.html`);
      writeFileSync(html, frameHtml({ ...scene, image: pathToFileURL(join(RAW, scene.file)).href, fontUrl }));
      await page.goto(pathToFileURL(html).href);
      await page.screenshot(join(SHOTS, scene.file));
    }
    await page.setViewport(1024, 500, 1, false);
    const featureFile = join(scratch, "feature.html");
    writeFileSync(
      featureFile,
      featureHtml({ image: pathToFileURL(join(RAW, "01-home.png")).href, fontUrl, iconUrl: pathToFileURL(iconFile).href }),
    );
    await page.goto(pathToFileURL(featureFile).href);
    await page.screenshot(join(OUT, "feature-graphic.png"));
    rmSync(scratch, { recursive: true, force: true });
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
