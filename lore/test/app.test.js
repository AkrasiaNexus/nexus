const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { build, DIST } = require('../tools/build.js');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const TAGS = new Set(['sunset', 'chaos', 'chill', 'edge', 'food']);

let server, base, browser, page;

test.before(async () => {
  build();
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html');
    const file = path.join(DIST, path.normalize(rel));
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.goto(base);
  await page.waitForSelector('#quest h2');
});

test.after(async () => {
  await browser.close();
  server.close();
});

test('every spot has complete, sane data', async () => {
  const { spots, bosses, bounds } = await page.evaluate(() => ({ spots: SPOTS, bosses: BOSSES, bounds: B }));
  assert.ok(spots.length >= 10);
  assert.equal(new Set(spots.map(s => s.id)).size, spots.length, 'ids are unique');
  for (const s of spots) {
    const where = `spot ${s.id}`;
    for (const key of ['name', 'short', 'why', 'hunt', 'cover']) assert.ok(typeof s[key] === 'string' && s[key].trim(), `${where}: ${key}`);
    assert.ok(s.lat >= bounds.s && s.lat <= bounds.n && s.lng >= bounds.w && s.lng <= bounds.e, `${where}: inside the map`);
    assert.ok(s.km > 0 && s.dur > 0 && s.walk >= 0, `${where}: route numbers`);
    assert.ok(s.entry >= 0 && s.spend >= 0, `${where}: costs`);
    assert.ok(s.legs.length > 0, `${where}: at least one bus leg`);
    for (const leg of s.legs) for (const key of ['line', 'toward', 'from', 'to']) assert.ok(leg[key], `${where}: leg ${key}`);
    assert.ok(s.tags.length && s.tags.every(t => TAGS.has(t)), `${where}: tags`);
    if (s.taxi) assert.ok(s.taxi.min > 0 && s.taxi.km > 0 && s.taxi.from, `${where}: taxi`);
  }
  const ids = new Set(spots.map(s => s.id));
  for (const b of bosses) assert.ok(ids.has(b.a) && ids.has(b.b), `boss ${b.id} uses real spots`);
});

test('bus and taxi fares follow the published Abu Dhabi rules', async () => {
  const r = await page.evaluate(() => [fare(10), fare(0), fare(200), taxiFare(1), taxiFare(9.7)]);
  assert.deepEqual(r.map(x => +x.toFixed(2)), [2.5, 2, 5, 12, 22.65]);
});

test('sunset times match Abu Dhabi within a few minutes', async () => {
  const [june, nov, dec] = await page.evaluate(() => [
    sunsetMinutes(new Date(Date.UTC(2026, 5, 21))),
    sunsetMinutes(new Date(Date.UTC(2026, 10, 10))),
    sunsetMinutes(new Date(Date.UTC(2026, 11, 21)))
  ]);
  const near = (got, h, m) => Math.abs(got - (h * 60 + m)) <= 5;
  assert.ok(near(june, 19, 12), `June ${june}`);
  assert.ok(near(nov, 17, 35), `Nov ${nov}`);
  assert.ok(near(dec, 17, 36), `Dec ${dec}`);
});

test('the planner respects closing times and the curfew', async () => {
  const r = await page.evaluate(() => {
    const mina = byId('mina');
    state.start = 17 * 60; state.curfew = 22 * 60 + 30;
    const early = planQuest(mina, MAIN[0]);
    state.start = 18 * 60 + 30;
    const late = planQuest(mina, MAIN[0]);
    state.start = 21 * 60 + 30; state.curfew = 22 * 60;
    const tooShort = planQuest(byId('raha'), MAIN[0]);
    state.start = 17 * 60; state.curfew = 22 * 60 + 30;
    return { early, late, tooShort };
  });
  assert.equal(r.early.fail, undefined);
  assert.ok(r.early.stay <= 120, 'markets cap the stay at 2 hours');
  assert.match(r.late.fail, /Get there by 18:30/);
  assert.match(r.tooShort.fail, /Under 45 minutes/);
});

test('installs as a PWA and still works offline', async () => {
  const context = await browser.newContext();
  const p = await context.newPage();
  await p.goto(base);
  const manifest = await p.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]').href;
    return (await fetch(href)).json();
  });
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512'));

  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  assert.ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');

  await context.setOffline(true);
  await p.reload();
  await p.waitForSelector('#quest h2');
  assert.equal(await p.title(), 'Lore Abu Dhabi');
  await context.close();
});
