import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "../explainer/build.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
  chromium = null;
}

test("the explainer steps through RAPTOR and shows a real journey", { skip: !chromium && "playwright not installed" }, async () => {
  build();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + path.join(HERE, "..", "explainer", "index.html"));

  assert.match(await page.textContent("#narr"), /Round 0/);
  assert.equal(await page.textContent("#originName"), "Hudayriyat");

  let steps = 0;
  while (!(await page.isDisabled("#next")) && steps < 100) {
    await page.click("#next");
    steps++;
  }
  assert.match(await page.textContent("#narr"), /^Done after \d rounds?/);
  assert.equal(await page.textContent("#sStops"), "12", "every stop reachable at 08:00");
  assert.ok(Number(await page.textContent("#sRound")) >= 2, "needs at least two buses somewhere");

  await page.click("#s-5"); // Mangroves
  const narr = await page.textContent("#narr");
  assert.match(narr, /^Hudayriyat → Mangroves: \d+ min/);
  assert.match(narr, /bus 73 .* Hudayriyat → .*bus 54|walk to Mushrif/);
  assert.ok(await page.locator("#journey polyline").count() >= 1, "journey drawn on the map");

  await page.fill("#depart", "20");
  assert.match(await page.textContent("#departOut"), /08:20/);
  assert.match(await page.textContent("#narr"), /Round 0/, "changing the time restarts");
  assert.deepEqual(errors, []);
  await browser.close();
});
