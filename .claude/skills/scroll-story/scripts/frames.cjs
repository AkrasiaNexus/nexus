// Screenshot chosen story points on desktop or mobile. Usage: URL=... MODE=d|m FRAMES=0,0.15,0.4 OUT=. node frames.cjs
const { chromium, devices } = require("playwright");
const URL = process.env.URL || "http://localhost:3000/", TRACK = process.env.TRACK || "[data-track]", MODE = process.env.MODE || "d", OUT = process.env.OUT || ".";
const FR = (process.env.FRAMES || "0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.97").split(",").map(Number);
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext(MODE === "m" ? { ...devices["iPhone 13"], deviceScaleFactor: 1 } : { viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  for (const f of FR) { await page.evaluate(([f, T]) => { const t = document.querySelector(T); scrollTo(0, t.offsetTop + (t.offsetHeight - innerHeight) * f); }, [f, TRACK]); await page.waitForTimeout(1600); await page.screenshot({ path: `${OUT}/${MODE}-${String(f).replace(".", "_")}.png` }); }
  console.log("errors:", errs.length ? errs : "none"); await browser.close();
})();
