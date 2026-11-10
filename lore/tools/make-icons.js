// Renders the Lore mark (a sun dropping into fog over a grid) to PNG app icons.
const path = require('node:path');
const { chromium } = require('playwright');

const mark = pad => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0A1220"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <g stroke="#2EC4B6" stroke-opacity=".35" stroke-width="6">
      <path d="M96 352H416M96 400H416M160 304V448M256 304V448M352 304V448"/>
    </g>
    <circle cx="256" cy="250" r="112" fill="#FFB547"/>
    <rect x="96" y="262" width="320" height="200" fill="#0A1220" fill-opacity=".86"/>
    <path d="M96 262H416" stroke="#FFB547" stroke-width="10" stroke-linecap="round"/>
  </g>
</svg>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = path.join(__dirname, '..', 'pwa', 'icons');
  for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-maskable-512', 512, 70]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${mark(pad)}`);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  }
  await browser.close();
})();
