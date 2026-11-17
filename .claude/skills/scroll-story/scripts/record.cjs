// Record a steady scroll-through as webm → convert: ffmpeg -i in.webm -c:v libx264 -crf 26 -pix_fmt yuv420p -movflags +faststart -an out.mp4
// Usage: URL=... OUT=vid SECONDS=45 node record.cjs
const { chromium } = require("playwright");
const URL = process.env.URL || "http://localhost:3000/", TRACK = process.env.TRACK || "[data-track]", OUT = process.env.OUT || "vid", SECS = +(process.env.SECONDS || 45);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT, size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" }); await page.waitForTimeout(2500);
  await page.evaluate(([T, ms]) => new Promise((done) => { const t = document.querySelector(T); const end = t.offsetTop + t.offsetHeight - innerHeight + 200, t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); scrollTo(0, end * k); k < 1 ? requestAnimationFrame(step) : done(); }; requestAnimationFrame(step); }), [TRACK, SECS * 1000]);
  await page.waitForTimeout(2500); await ctx.close(); await browser.close();
})();
