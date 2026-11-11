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

test('two phones share a Lore Book by swapping a code', async () => {
  const phoneA = await browser.newContext();
  const a = await phoneA.newPage();
  await a.goto(base);
  await a.waitForSelector('#done');
  await a.click('#done');
  await a.click('#share summary');
  await a.waitForFunction(() => document.getElementById('myCode').value.startsWith('CF1.'));
  const code = await a.inputValue('#myCode');

  const phoneB = await browser.newContext();
  const b = await phoneB.newPage();
  await b.goto(base);
  await b.waitForSelector('#quest h2');
  await b.click('#share summary');
  await b.fill('#theirCode', code);
  await b.click('#mergeCode');
  await b.waitForFunction(() => /^Merged/.test(document.getElementById('syncStatus').textContent));
  assert.equal(await b.textContent('#loreCount'), '1 entry');
  assert.match(await b.textContent('#explored'), /^1 of \d+ explored$/);
  assert.match(await b.textContent('#syncStatus'), /1 new entry, 1 new place/);
  assert.equal(await b.textContent('#lore .lt'), await a.textContent('#lore .lt'));

  await b.fill('#theirCode', 'CF1.not-a-real-code.00000000');
  await b.click('#mergeCode');
  await b.waitForFunction(() => /damaged/.test(document.getElementById('syncStatus').textContent));
  assert.equal(await b.textContent('#loreCount'), '1 entry', 'a bad code changes nothing');
  await phoneA.close();
  await phoneB.close();
});

test('a code that would overflow the Lore Book is refused and changes nothing', async () => {
  const context = await browser.newContext();
  const p = await context.newPage();
  await p.goto(base);
  await p.waitForSelector('#done');
  await p.click('#done');
  const hostile = await p.evaluate(async () => {
    let junk = Campfire.emptyState();
    for (let i = 0; i < 500; i++) junk = Campfire.addEntry(junk, 'zz', `zz-${i}`, { title: 'junk', meta: 'junk', created: i });
    return Campfire.encode(junk);
  });
  const before = await p.evaluate(() => localStorage.getItem('lore-abudhabi.v2'));
  await p.click('#share summary');
  await p.fill('#theirCode', hostile);
  await p.click('#mergeCode');
  await p.waitForFunction(() => /too many entries/.test(document.getElementById('syncStatus').textContent));
  assert.equal(await p.textContent('#loreCount'), '1 entry');
  await p.reload();
  await p.waitForSelector('#lore .lt');
  assert.equal(await p.evaluate(() => localStorage.getItem('lore-abudhabi.v2')), before, 'saved book untouched');
  await context.close();
});

test('a saved Lore Book that cannot be read is never overwritten', async () => {
  const context = await browser.newContext();
  const corrupt = JSON.stringify({ replica: 'ali', book: { v: 1, clock: -5, entries: {}, explored: [] } });
  await context.addInitScript(raw => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('lore-abudhabi.v2', raw); sessionStorage.setItem('seeded', '1'); } }, corrupt);
  const p = await context.newPage();
  await p.goto(base);
  await p.waitForSelector('#done');
  assert.match(await p.textContent('#syncStatus'), /left untouched/);
  await p.click('#done');
  assert.equal(await p.evaluate(() => localStorage.getItem('lore-abudhabi.v2')), corrupt);
  await context.close();
});

test('an old v1 Lore Book is migrated, notes and map included', async () => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    if (!localStorage.getItem('lore-abudhabi.v2')) {
      localStorage.setItem('lore-abudhabi.v1', JSON.stringify({ explored: ['mina'], lore: [{ id: 'x', title: 'The Mina Draft', meta: 'Nov 10 · 4 out · Mina', note: 'Omar bought a cactus' }] }));
    }
  });
  const p = await context.newPage();
  await p.goto(base);
  await p.waitForSelector('#lore .lt');
  assert.equal(await p.textContent('#lore .lt'), 'The Mina Draft');
  assert.equal(await p.inputValue('#lore input'), 'Omar bought a cactus');
  assert.match(await p.textContent('#explored'), /^1 of/);
  await context.close();
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
