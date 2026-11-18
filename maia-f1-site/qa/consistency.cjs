// Fast jump vs slow scroll must land on the same visible state. Prints ALL CONSISTENT or the differences.
// Usage: URL=http://127.0.0.1:8800/ node qa/consistency.cjs
const { open, scrollToProgress, settle } = require('./lib.cjs');

const TARGETS = [1, 2, 5, 6, 7, 8, 9, 10].map((i) => (i + 0.5) / 11); // chapter centres

const snapshot = (page) => page.evaluate(() => {
  const r = (v) => Math.round(v * 100) / 100;
  const s = window.__hermes.state;
  return JSON.stringify({
    chapters: [...document.querySelectorAll('.chapter')].map((c) => r(+getComputedStyle(c).opacity)),
    words: [...document.querySelectorAll('.chapter h2 .word')].map((w) => r(+getComputedStyle(w).opacity)),
    cards: [...document.querySelectorAll('[data-deal], .meter')].map((c) => getComputedStyle(c).transform.replace(/-?\d+\.\d+/g, (n) => r(+n)) + r(+getComputedStyle(c).opacity)),
    sky: [document.querySelector('#sky').style.opacity, document.querySelector('#sky').style.transform],
    lamps: [...document.querySelectorAll('.lamp')].map((l) => r(+getComputedStyle(l).opacity)),
    counters: [...document.querySelectorAll('[data-count]')].map((c) => c.textContent),
    hud: document.querySelector('#hud-index').textContent,
    cta: document.querySelector('.final-cta').inert,
    // 0.1 rad: mid-turntable the camera spins ~90 rad per unit of progress, so a settled residual moves it a hair.
    camera: [s.theta, s.phi, s.dist].map((v) => Math.round(v * 10) / 10),
    constellation: r(s.constellation),
  });
});

(async () => {
  const { browser, page, errors } = await open();
  await page.waitForTimeout(1500);
  const diffs = [];
  for (const p of TARGETS) {
    // fast: jump from the far end straight to p
    await scrollToProgress(page, 1); await settle(page, 1);
    await scrollToProgress(page, p); await settle(page, p, 0.00005);
    const fast = await snapshot(page);
    // slow: walk from the start in small steps
    await scrollToProgress(page, 0); await settle(page, 0);
    for (let q = 0; q < p; q += 0.02) { await scrollToProgress(page, q); await page.waitForTimeout(40); }
    await scrollToProgress(page, p); await settle(page, p, 0.00005);
    const slow = await snapshot(page);
    const f = JSON.parse(fast);
    const s = JSON.parse(slow);
    const keys = Object.keys(f).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(s[k]));
    console.log(`p=${p.toFixed(3)}`, keys.length ? `DIFFERENT in ${keys.join(', ')}` : 'consistent');
    if (keys.length) diffs.push({ p, ...Object.fromEntries(keys.map((k) => [k, { fast: f[k], slow: s[k] }])) });
  }
  console.log(diffs.length ? `INCONSISTENT\n${JSON.stringify(diffs).slice(0, 3000)}` : 'ALL CONSISTENT');
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  process.exit(diffs.length || errors.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
