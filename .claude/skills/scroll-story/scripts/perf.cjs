// Wheel-scroll the whole track; report fps and long tasks. Usage: URL=... node perf.cjs
const { chromium } = require("playwright");
const URL = process.env.URL || "http://localhost:3000/", TRACK = process.env.TRACK || "[data-track]";
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => { window.__l = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__l.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true }); window.__f = 0; const t = () => { window.__f++; requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const t0 = Date.now(), f0 = await page.evaluate(() => window.__f);
  for (let i = 0; i < 260; i++) { await page.mouse.wheel(0, 420); await page.waitForTimeout(16); }
  const s = (Date.now() - t0) / 1000, fps = Math.round(((await page.evaluate(() => window.__f)) - f0) / s), long = await page.evaluate(() => window.__l);
  const reached = await page.evaluate((T) => { const t = document.querySelector(T); return Math.min(1, (scrollY - t.offsetTop) / (t.offsetHeight - innerHeight)).toFixed(2); }, TRACK);
  console.log(`progress ${reached} · ~${fps} fps · long tasks ${long.length}${long.length ? " (max " + Math.max(...long) + "ms)" : ""}`);
  await browser.close();
})();
