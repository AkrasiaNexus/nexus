// Visual frames at story points. Usage: URL=http://127.0.0.1:8800/ MODE=d|m OUT=dir AT=0,0.2,... node qa/frames.cjs
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8800/';
const MODE = process.env.MODE || 'd';
const OUT = process.env.OUT || 'qa/out';
const AT = (process.env.AT || Array.from({ length: 11 }, (_, i) => ((i + 0.5) / 11).toFixed(3)).join(',')).split(',').map(Number);
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: GL });
  const vp = MODE === 'm' ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hermes, null, { timeout: 60000 });
  await page.waitForTimeout(2200);
  for (const p of AT) {
    await page.evaluate((pp) => {
      const t = document.querySelector('[data-track]');
      const top = t.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + pp * (t.offsetHeight - innerHeight), behavior: 'instant' });
    }, p);
    await page.waitForFunction((pp) => Math.abs(window.__hermes.progress() - pp) < 0.002, p, { timeout: 60000, polling: 200 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${MODE}-${p}.png` });
  }
  console.log('frames', MODE, AT.length, 'errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
