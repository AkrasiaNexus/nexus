// Runs the built web app in Chromium: capture, plan, check-in notifications, and the orb.
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

  await page.getByRole("button", { name: /Everything/ }).click();
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
  await page.getByRole("button", { name: /Everything/ }).click();
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

test("the orb rests as a circle on a transparent page, and opens on a click", async () => {
  const page = await browser.newPage();
  await page.goto(base + "?view=orb");

  const transparent = await page.evaluate(() => [
    getComputedStyle(document.documentElement).backgroundColor,
    getComputedStyle(document.body).backgroundColor,
  ]);
  assert.deepEqual(transparent, ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"], "an opaque page makes the round window a square");
  assert.equal(await page.getByPlaceholder(/tell donna/).count(), 0, "nothing but the circle at rest");

  await page.getByRole("button", { name: "Ask Donna" }).click();
  await assert.doesNotReject(page.getByPlaceholder(/tell donna/).waitFor());

  await page.close();
});

test("the daily brief answers from the plan itself, without calling the model", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let modelCalls = 0;
  await page.route("http://127.0.0.1:11434/api/chat", async (route) => { modelCalls++; await route.abort(); });
  await page.addInitScript(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    localStorage.setItem("donna_plan", JSON.stringify({
      blocks: [{ id: "b1", itemId: null, title: "Rust ownership", date, start: "23:30", minutes: 30, done: false }],
      fixed: [], sweptOn: date,
    }));
  });
  await page.goto(base + "?view=orb");

  await page.getByRole("button", { name: "Ask Donna" }).click();
  await page.getByRole("button", { name: "brief" }).click();

  await assert.doesNotReject(page.getByText(/free|day's gone|booked/i).first().waitFor());
  assert.equal(modelCalls, 0, "the brief is computed, so Ollama is never asked");

  await context.close();
});

const OLLAMA_CHAT = "http://127.0.0.1:11434/api/chat";
const ollamaSays = (message) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ message }) });

test("the orb hands the blurt to Donna, stays responsive while she thinks, and her goal lands in shared storage", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let release;
  const held = new Promise((r) => { release = r; });
  const replies = [
    { content: "", tool_calls: [{ function: { name: "add_goal", arguments: { title: "learn rust", due: "2099-12-05", minutes_per_day: 30 } } }] },
    { content: "added rust, 30 mins a day till dec 5." },
  ];
  await page.route(OLLAMA_CHAT, async (route) => {
    await held;
    await route.fulfill(ollamaSays(replies.shift()));
  });
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: "Ask Donna" }).click();

  const input = page.getByPlaceholder(/tell donna/);
  await input.fill("learn rust 30 mins a day till dec 5");
  await input.press("Enter");

  assert.equal(await input.inputValue(), "", "the input clears before Donna answers");
  await assert.doesNotReject(page.getByRole("status", { name: "Donna is thinking" }).waitFor());
  await input.fill("second thought");
  await input.press("Enter");
  assert.equal(await input.inputValue(), "second thought", "a send while busy keeps the text");

  release();
  await assert.doesNotReject(page.getByText("added rust, 30 mins a day till dec 5.").waitFor());
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nudge_items"))[0]);
  assert.equal(saved.title, "Learn rust");
  assert.equal(saved.minutesPerDay, 30);
  assert.equal(await page.getByRole("status", { name: "Donna is thinking" }).count(), 0);

  await context.close();
});

test("with Ollama down the orb says how to fix it instead of hanging", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(OLLAMA_CHAT, (route) => route.abort("connectionrefused"));
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: "Ask Donna" }).click();

  const input = page.getByPlaceholder(/tell donna/);
  await input.fill("gym at 6");
  await input.press("Enter");

  await assert.doesNotReject(page.getByText(/ollama isn't running/).waitFor());
  await context.close();
});
