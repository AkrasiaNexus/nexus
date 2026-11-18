// Functional asserts: content, chapter nav, CTA gating, Pleiades, panels, reduced motion, resize, overflow, errors.
// Usage: URL=http://127.0.0.1:8800/ node qa/functional.cjs
const { DESKTOP, PHONE, open, scrollToProgress, settle } = require('./lib.cjs');

const N = 11;
const centre = (i) => (i + 0.5) / N;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const hud = (page) => page.textContent('#hud-index');
const settleOnScroll = (page) => page.waitForFunction(() => Math.abs(window.__hermes.progress() - window.__hermes.target()) < 0.0015, null, { timeout: 90000, polling: 200 });
const visibleIn = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((n) => {
  let o = 1;
  for (let e = n; e && e.nodeType === 1; e = e.parentElement) o *= +getComputedStyle(e).opacity;
  return o > 0.95;
}).length, sel);

(async () => {
  // ---------- desktop ----------
  let { browser, page, errors } = await open(DESKTOP);
  await page.waitForTimeout(1500);
  // splitText keeps one accessible copy of the headline and hides the animated words from screen readers.
  check('hero headline is real, accessible text', (await page.textContent('h1 > span:not([aria-hidden])')) === 'Hermes V1.');
  check('no driver anywhere in the copy', !/driver/i.test(await page.textContent('body')));
  const sky = await page.evaluate(() => ({ stars: document.querySelectorAll('#sky .sky-star').length, names: [...document.querySelectorAll('#sky text')].map((t) => t.textContent) }));
  check('Pleiades: nine stars, only Maia labelled', sky.stars === 9 && sky.names.join() === 'Maia', JSON.stringify(sky));

  await scrollToProgress(page, centre(6)); await settle(page, centre(6)); await page.waitForTimeout(200);
  check('CFD chapter: three iterations on screen', (await visibleIn(page, '.iteration')) === 3);
  check('Hermes V1 marked Selected', (await page.textContent('.iteration.is-chosen .chip')) === 'Selected');
  await scrollToProgress(page, centre(7)); await settle(page, centre(7)); await page.waitForTimeout(200);
  check('Team chapter: six members on screen', (await visibleIn(page, '.member')) === 6);
  await scrollToProgress(page, centre(9)); await settle(page, centre(9)); await page.waitForTimeout(200);
  check('Partners chapter: four tiers on screen', (await visibleIn(page, '.tier')) === 4);

  for (const [label, ch] of [['CFD', 6], ['Team', 7], ['Partner with us', 9]]) {
    await scrollToProgress(page, 0); await settle(page, 0);
    await page.click(`.bar nav >> text=${label}`);
    await page.waitForTimeout(1500); await settleOnScroll(page);
    const at = await hud(page);
    check(`nav "${label}" lands on chapter ${ch + 1}`, +at === ch + 1, `hud ${at}`);
  }

  await scrollToProgress(page, 0.5); await settle(page, 0.5);
  check('final CTA is inert mid-story', await page.evaluate(() => document.querySelector('.final-cta').inert));
  await scrollToProgress(page, 0.99); await settle(page, 0.99);
  check('final CTA is live at the end', !(await page.evaluate(() => document.querySelector('.final-cta').inert)));
  await page.click('.final-cta >> text=Meet the team');
  await page.waitForTimeout(1500); await settleOnScroll(page);
  check('final CTA "Meet the team" lands on the team chapter', +(await hud(page)) === 8, `hud ${await hud(page)}`);

  // resize desktop -> phone -> desktop mid-story keeps the chapter
  await scrollToProgress(page, centre(4)); await settle(page, centre(4));
  const before = await hud(page);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(1200); await settleOnScroll(page);
  const onPhone = await hud(page);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(1200); await settleOnScroll(page);
  const after = await hud(page);
  check('resize keeps the chapter', before === onPhone && onPhone === after, `${before} -> ${onPhone} -> ${after}`);
  check('no console or page errors (desktop)', errors.length === 0, errors.join(' | '));
  await browser.close();

  // ---------- phone ----------
  ({ browser, page, errors } = await open(PHONE));
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('phone: no horizontal scroll', overflow <= 0, `${overflow}px`);
  for (const [ch, sel, n] of [[6, '.iteration', 3], [7, '.member', 6], [9, '.tier', 4]]) {
    await scrollToProgress(page, centre(ch)); await settle(page, centre(ch)); await page.waitForTimeout(200);
    const fits = await page.evaluate((s) => [...document.querySelectorAll(s)].every((n) => { const r = n.getBoundingClientRect(); return r.top >= 60 && r.bottom <= innerHeight - 30; }), sel);
    check(`phone: ${sel} panel fits the screen`, fits);
  }
  check('no console or page errors (phone)', errors.length === 0, errors.join(' | '));
  await browser.close();

  // ---------- reduced motion ----------
  ({ browser, page, errors } = await open({ ...DESKTOP, reducedMotion: 'reduce' }));
  await page.waitForTimeout(800);
  let visible = 0;
  const cams = new Set();
  for (let i = 0; i < N; i += 1) {
    await scrollToProgress(page, centre(i)); await settle(page, centre(i));
    await page.waitForTimeout(150);
    const o = await page.evaluate((k) => +getComputedStyle(document.querySelectorAll('.chapter')[k]).opacity, i);
    if (o > 0.95) visible += 1;
    cams.add(await page.evaluate(() => { const s = window.__hermes.state; return [s.theta, s.phi, s.dist].map((v) => v.toFixed(3)).join(','); }));
  }
  check('reduced motion: every chapter becomes readable', visible === N, `${visible}/${N}`);
  check('reduced motion: the camera never moves', cams.size === 1, [...cams].join(' | '));
  check('no console or page errors (reduced motion)', errors.length === 0, errors.join(' | '));
  await browser.close();

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
