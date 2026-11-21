// Generic scroll-story functional checks. Env:
//   URL, TRACK='[data-track]', CH='[data-ch]' (one block per chapter, in order), CTA='[data-cta]',
//   SIGNATURE='[data-rig]' (element whose transform the timeline drives; must stay still under reduced motion)
const { chromium } = require("playwright");
const E = (k, d) => process.env[k] || d;
const URL = E("URL", "http://localhost:3000/"), TRACK = E("TRACK", "[data-track]"), CH = E("CH", "[data-ch]"), CTA = E("CTA", "[data-cta]"), SIG = E("SIGNATURE", "[data-rig]");
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"} ${m}`); };
(async () => {
  const browser = await chromium.launch(), errs = [];
  const fresh = async (o = {}) => { const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, ...o })).newPage();
    p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 140)));
    await p.goto(URL, { waitUntil: "networkidle" }); return p; };
  const go = (p, f, w = 1800) => p.evaluate(([f, T]) => { const t = document.querySelector(T); scrollTo(0, t.offsetTop + (t.offsetHeight - innerHeight) * f); }, [f, TRACK]).then(() => p.waitForTimeout(w));
  const vis = (p, sel, i = 0) => p.evaluate(([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return 0; let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; }, [sel, i]);
  let p = await fresh();
  const n = await p.evaluate((s) => document.querySelectorAll(s).length, CH);
  ok(n > 0, `found ${n} chapter blocks (${CH})`);
  await go(p, 0.5);
  ok(await p.evaluate((s) => { const c = document.querySelector(s); return !c || getComputedStyle(c).pointerEvents === "none" || c.hasAttribute("inert"); }, CTA), "CTA not clickable mid-story");
  await go(p, 0.995, 2500);
  ok(await p.evaluate((s) => { const c = document.querySelector(s); return !!c && getComputedStyle(c).pointerEvents !== "none" && !c.hasAttribute("inert"); }, CTA), "CTA clickable at the end");
  // Every chapter's copy becomes visible at its own midpoint (normal motion).
  let seen = 0; for (let i = 0; i < n; i++) { await go(p, (i + 0.5) / n, 1500); if ((await vis(p, CH, i)) > 0.5) seen++; }
  ok(seen === n, `normal motion: ${seen}/${n} chapters readable at their midpoint`);
  // Reduced motion: same, and the signature never moves.
  p = await fresh({ reducedMotion: "reduce" });
  const t0 = await p.evaluate((s) => document.querySelector(s)?.style.transform ?? "", SIG); seen = 0;
  for (let i = 0; i < n; i++) { await go(p, (i + 0.5) / n, 1500); if ((await vis(p, CH, i)) > 0.5) seen++; }
  ok(seen === n, `reduced motion: ${seen}/${n} chapters readable`);
  ok((await p.evaluate((s) => document.querySelector(s)?.style.transform ?? "", SIG)) === t0, "reduced motion: signature stays still");
  // Resize across the mobile breakpoint mid-story keeps the same chapter on screen.
  p = await fresh(); const mid = Math.floor(n * 0.6); await go(p, (mid + 0.5) / n);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(1500);
  ok((await vis(p, CH, mid)) > 0.5, `resize to mobile keeps chapter ${mid + 1}`);
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(1500);
  ok((await vis(p, CH, mid)) > 0.5, `resize back keeps chapter ${mid + 1}`);
  ok(errs.length === 0, `console errors: ${errs.length ? errs.slice(0, 3).join(" | ") : "none"}`);
  console.log(fails ? `${fails} FAILED` : "ALL PASS"); await browser.close(); process.exit(fails ? 1 : 0);
})();
