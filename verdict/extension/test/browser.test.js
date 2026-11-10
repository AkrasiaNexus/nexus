// Runs the detectors and the popup in real Chromium.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SCRIPTS = ['src/lessons.js', 'src/verify.js', 'src/detectors.js'].map(read);

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function detect(fixture) {
  const page = await browser.newPage();
  await page.setContent(read(`test/fixtures/${fixture}`));
  for (const content of SCRIPTS) await page.addScriptTag({ content });
  const found = await page.evaluate(() => Verdict.detectAll(document).map(({ el, input, ...f }) => f));
  await page.close();
  return found;
}

test('flags every trick on the tricks shop', async () => {
  const found = await detect('tricks.html');
  const types = found.map(f => f.type).sort();
  assert.deepEqual(types, ['addon', 'drip', 'privacy', 'scarcity', 'scarcity', 'shame', 'timer', 'trial']);

  const byType = t => found.find(f => f.type === t);
  assert.ok(byType('timer').seconds > 280 && byType('timer').seconds <= 299);
  assert.equal(byType('addon').price, 29);
  assert.deepEqual([byType('trial').price, byType('trial').period], [59, 'month']);
  const scarcity = found.filter(f => f.type === 'scarcity');
  assert.ok(scarcity.some(f => f.count === 2), 'reads "Only 2 left"');
  assert.ok(scarcity.some(f => f.viewers === 14), 'reads "14 people are viewing"');
});

test('flags nothing on the honest shop', async () => {
  assert.deepEqual(await detect('clean.html'), []);
});

test('popup shows the ruling, yearly trial cost and hours of work', async () => {
  const page = await browser.newPage();
  const findings = [
    { type: 'trial', text: '7 days free, then AED 59 a month', price: 59, period: 'month' },
    { type: 'addon', text: 'Add 2-year protection · AED 29', price: 29, ticked: true },
    { type: 'timer', text: 'Sale ends in 04:59', seconds: 299, verified: 'reset' }
  ];
  await page.addInitScript(f => {
    window.chrome = {
      storage: { sync: { get: async () => ({}), set: async () => {} } },
      tabs: {
        query: async () => [{ id: 7, url: 'https://northbay.example/checkout' }],
        sendMessage: async () => ({ findings: f })
      }
    };
  }, findings);
  await page.goto('file://' + path.join(ROOT, 'popup/popup.html'));
  const text = await page.locator('main').innerText();
  assert.match(text, /3 tricks on this page/);
  assert.match(text, /1 proven by revisiting/);
  assert.match(text, /AED 708 a year = 27\.2 h of your work/);
  assert.match(text, /Proven fake/);
  assert.equal(await page.locator('.btn').count(), 1, 'offers to untick the pre-ticked add-on');
  assert.equal(await page.locator('#host').innerText(), 'northbay.example');
  await page.close();
});

test('popup text from the page is rendered as text, never as HTML', async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.chrome = {
      storage: { sync: { get: async () => ({}), set: async () => {} } },
      tabs: { query: async () => [{ id: 1, url: 'https://x.example/' }], sendMessage: async () => ({ findings: [{ type: 'drip', text: '<img src=x onerror="window.pwned=1">' }] }) }
    };
  });
  await page.goto('file://' + path.join(ROOT, 'popup/popup.html'));
  await page.waitForSelector('.quote');
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.equal(await page.locator('.quote img').count(), 0);
  await page.close();
});
