// Renders the Verdict mark to PNG at each size Chrome needs.
const path = require('node:path');
const { chromium } = require('playwright');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0B1220"/>
  <circle cx="58" cy="58" r="30" fill="none" stroke="#19E39A" stroke-width="13"/>
  <path d="M80 80 L104 104" stroke="#19E39A" stroke-width="15" stroke-linecap="round"/>
  <circle cx="58" cy="58" r="10" fill="#FF5A5F"/>
</svg>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [16, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${SVG}`);
    await page.screenshot({ path: path.join(__dirname, '..', 'icons', `icon${size}.png`), omitBackground: true });
  }
  await browser.close();
})();
