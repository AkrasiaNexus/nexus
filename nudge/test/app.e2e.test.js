// Runs the built web app in Chromium: capture, plan, check-in notifications, and the quick-capture window.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

let server, base, browser;

test.before(async () => {
  execSync("npx vite build --logLevel error", { cwd: ROOT });
  server = http.createServer((req, res) => {
    const rel = req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0];
    const file = path.join(DIST, path.normalize(rel));
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

test.after(async () => {
  await browser.close();
  server.close();
});

test("a blurt becomes a planned, categorised card", async () => {
  const page = await browser.newPage();
  await page.goto(base);
  const input = page.getByPlaceholder(/blurt it out/);
  await input.fill("i wanna learn rust in 2 weeks");
  await input.press("Enter");
  await input.fill("call mom tomorrow");
  await input.press("Enter");

  await page.getByRole("button", { name: /All Nudges/ }).click();
  await assert.doesNotReject(page.getByText("Learn rust", { exact: true }).waitFor());
  await assert.doesNotReject(page.getByText("Call mom", { exact: true }).waitFor());
  assert.equal(await page.getByText("skill", { exact: true }).count(), 1);
  await page.close();
});

test("slang is understood before parsing (Idiolect profile)", async () => {
  const page = await browser.newPage();
  await page.goto(base);
  const input = page.getByPlaceholder(/blurt it out/);
  await input.fill("lowk wanna learn rust jus 2 wks");
  await input.press("Enter");
  await page.getByRole("button", { name: /All Nudges/ }).click();
  await assert.doesNotReject(page.getByText("Learn rust", { exact: true }).waitFor());
  await page.close();
});

test("the This Week count matches what the week planner shows", async () => {
  const page = await browser.newPage();
  await page.goto(base);
  const input = page.getByPlaceholder(/blurt it out/);
  for (const text of ["call mom tomorrow", "gym 3x this week", "finish the essay in 3 days"]) {
    await input.fill(text);
    await input.press("Enter");
  }
  const badge = await page.getByRole("button", { name: /This Week/ }).innerText();
  const datedCards = await page.locator("main h3:not(:text('Later')) + div > div").count();
  assert.equal(Number(badge.match(/\d+/)[0]), datedCards);
  await page.close();
});

test("a check-in that came due fires one notification", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__shown = [];
    window.Notification = class {
      static permission = "granted";
      static requestPermission = async () => "granted";
      constructor(title, opts) { window.__shown.push({ title, body: opts.body }); }
    };
    const DAY = 86_400_000;
    const created = Date.now() - 3 * DAY;
    const deadline = created + 8 * DAY;
    const at = (f) => new Date(created + (deadline - created) * f).toISOString();
    localStorage.setItem("nudge_items", JSON.stringify([{
      id: "1", raw: "learn rust 8 days", title: "Learn rust", category: "skill", effort: "medium",
      createdAt: new Date(created).toISOString(), deadline: new Date(deadline).toISOString(), timeframeMs: 8 * DAY,
      status: "active", completedAt: null,
      nudges: [[0.25, "gentle"], [0.5, "firm"], [0.75, "firm"], [1, "urgent"]].map(([f, tone]) => ({ at: at(f), pct: f * 100, tone })),
    }]));
    localStorage.setItem("nudge_last_check", String(created));
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__shown.length > 0);
  const shown = await page.evaluate(() => window.__shown);
  assert.equal(shown.length, 1, "only the latest check-in, not a burst");
  assert.match(shown[0].body, /Learn rust/);
  await context.close();
});

test("the quick-capture window shows only the input and confirms the save", async () => {
  const page = await browser.newPage();
  await page.goto(base + "?view=capture");
  assert.equal(await page.getByRole("button", { name: /This Week/ }).count(), 0, "no sidebar");
  const input = page.getByPlaceholder(/blurt it out/);
  await input.fill("look into tauri plugins this week");
  await input.press("Enter");
  await assert.doesNotReject(page.getByRole("status").getByText(/Saved: Look into tauri plugins \(explore\)/).waitFor());
  await page.close();
});
