// Shared helpers for the QA scripts. Playwright is preinstalled in cloud sessions.
const { chromium } = require('playwright');

const URL = process.env.URL || 'http://127.0.0.1:8800/';
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function open(contextOptions = DESKTOP) {
  const browser = await chromium.launch({ args: GL });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hermes, null, { timeout: 60000 });
  return { browser, context, page, errors };
}

/** Scroll so the story is at progress p (0..1 of the pinned track). */
function scrollToProgress(page, p) {
  return page.evaluate((pp) => {
    const t = document.querySelector('[data-track]');
    const top = t.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + pp * (t.offsetHeight - innerHeight), behavior: 'instant' });
  }, p);
}

/** Wait until the eased story progress has caught up with the scroll position. */
function settle(page, p, tolerance = 0.0015) {
  return page.waitForFunction(([pp, tol]) => Math.abs(window.__hermes.progress() - pp) < tol, [p, tolerance], { timeout: 90000, polling: 150 });
}

module.exports = { URL, DESKTOP, PHONE, open, scrollToProgress, settle };
