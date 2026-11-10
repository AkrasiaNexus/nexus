// Loads the real unpacked extension into Chromium and proves the fake-timer check end to end.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const EXT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');

let server, base, context;

test.before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FIXTURES, path.basename(req.url.split('?')[0]) || 'tricks.html');
    fs.readFile(file, (err, body) => {
      res.writeHead(err ? 404 : 200, { 'content-type': 'text/html' });
      res.end(err ? 'not found' : body);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-')), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
  });
});

test.after(async () => {
  await context.close();
  server.close();
});

test('highlights tricks on a live page and proves the timer is fake after a reload', async () => {
  const page = await context.newPage();
  await page.goto(`${base}/tricks.html`);
  await page.waitForFunction(() => document.querySelectorAll('[data-verdict]').length >= 7, null, { timeout: 10000 });
  assert.equal(await page.getAttribute('.timer', 'data-verdict-verified'), 'new');

  await page.waitForTimeout(4500);
  await page.reload();
  await page.waitForSelector('.timer[data-verdict-verified="reset"]', { timeout: 10000 });

  assert.equal(await page.getAttribute('.stock', 'data-verdict'), 'scarcity');
  assert.equal(await page.getAttribute('.stock', 'data-verdict-verified'), 'watching');
  await page.close();
});

test('leaves the honest shop alone', async () => {
  const page = await context.newPage();
  await page.goto(`${base}/clean.html`);
  await page.waitForTimeout(3000);
  assert.equal(await page.locator('[data-verdict]').count(), 0);
  await page.close();
});
