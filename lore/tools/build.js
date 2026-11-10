// Builds the installable app in dist/ from prototype.html (which stays the single source of truth).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function build() {
  const source = fs.readFileSync(path.join(ROOT, 'prototype.html'), 'utf8');
  const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 10);

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0A1220">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${source}
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');</script>
</body>
</html>
`;

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'index.html'), page);
  fs.copyFileSync(path.join(ROOT, 'pwa', 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));
  fs.writeFileSync(path.join(DIST, 'sw.js'), fs.readFileSync(path.join(ROOT, 'pwa', 'sw.js'), 'utf8').replace('__BUILD__', hash));
  for (const icon of fs.readdirSync(path.join(ROOT, 'pwa', 'icons'))) {
    fs.copyFileSync(path.join(ROOT, 'pwa', 'icons', icon), path.join(DIST, 'icons', icon));
  }
  return hash;
}

if (require.main === module) console.log(`Built dist/ (${build()})`);
module.exports = { build, DIST };
