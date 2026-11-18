// A smooth scroll-through video, captured frame by frame so slow headless rendering doesn't make it choppy.
// Usage: URL=http://127.0.0.1:8800/ OUT=/tmp/rec FRAMES=360 node qa/record.cjs
// Then: ffmpeg -y -framerate 30 -i $OUT/f%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 20 hermes.mp4
const fs = require('fs');
const { open, scrollToProgress, settle } = require('./lib.cjs');

const OUT = process.env.OUT || 'qa/rec';
const FRAMES = +(process.env.FRAMES || 360);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  await page.waitForTimeout(2500); // let the intro (lights up, headline builds) finish
  for (let i = 0; i < FRAMES; i += 1) {
    const p = i / (FRAMES - 1);
    await scrollToProgress(page, p);
    await settle(page, p, 0.0008);
    await page.screenshot({ path: `${OUT}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 });
    if (i % 60 === 0) console.log(`frame ${i}/${FRAMES}`);
  }
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
