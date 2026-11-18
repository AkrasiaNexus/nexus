// Frame rate and long tasks while wheeling through the whole story.
// Headless software GL (SwiftShader) is far slower than a real GPU, so treat these numbers as a floor.
// Usage: URL=http://127.0.0.1:8800/ node qa/perf.cjs
const { open } = require('./lib.cjs');

(async () => {
  const { browser, page, errors } = await open();
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__perf = { frames: 0, long: 0 };
    new PerformanceObserver((list) => { window.__perf.long += list.getEntries().length; }).observe({ type: 'longtask', buffered: false });
    const tick = () => { window.__perf.frames += 1; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  const trackH = await page.evaluate(() => document.querySelector('[data-track]').offsetHeight);
  for (let y = 0; y < trackH; y += 120) { await page.mouse.wheel(0, 120); await page.waitForTimeout(16); }
  const secs = (Date.now() - t0) / 1000;
  const { frames, long } = await page.evaluate(() => window.__perf);
  console.log(`scrolled ${trackH}px in ${secs.toFixed(1)}s · ${(frames / secs).toFixed(1)} fps · ${long} long tasks`);
  const kb = await page.evaluate(() => performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) / 1024);
  console.log(`transferred ${kb.toFixed(0)} KB (fonts, CDN modules, car model)`);
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
