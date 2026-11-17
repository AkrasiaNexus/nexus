// Fast-jump vs slow-scroll must land on the same VISIBLE state (opacity multiplied through ancestors).
// Usage: URL=http://localhost:3000/ TRACK='[data-track]' SNAP='[data-ch],[data-scr]' node consistency.cjs
const { chromium } = require("playwright");
const URL = process.env.URL || "http://localhost:3000/";
const TRACK = process.env.TRACK || "[data-track]";
const SNAP = process.env.SNAP || "[data-ch],[data-word],[data-scr],[data-cta]";
const TARGETS = (process.env.TARGETS || "0.03,0.26,0.55,0.79,0.98").split(",").map(Number); // fractions of the track
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const go = async (f, wait = 1800) => { await page.evaluate(([f, T]) => { const t = document.querySelector(T); scrollTo(0, t.offsetTop + (t.offsetHeight - innerHeight) * f); }, [f, TRACK]); await page.waitForTimeout(wait); };
  const snap = () => page.evaluate((S) => Array.from(document.querySelectorAll(S)).map((e, i) => {
    let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    return `${i}:${(Math.round(o * 20) / 20).toFixed(2)}`;
  }), SNAP);
  let bad = 0;
  for (const target of TARGETS) {
    await go(0, 600); for (let f = 0.025; f < target; f += 0.025) await go(f, 120); await go(target);
    const slow = await snap();
    await go(target > 0.5 ? 0 : 1, 1500); await go(target);
    const fast = await snap();
    const diff = slow.filter((s, i) => s !== fast[i]);
    console.log(`target ${target}: ${diff.length ? "MISMATCH " + diff.slice(0, 8).join(" ") : "consistent"}`);
    bad += diff.length;
  }
  console.log(bad ? "FAIL" : "ALL CONSISTENT");
  await browser.close(); process.exit(bad ? 1 : 0);
})();
