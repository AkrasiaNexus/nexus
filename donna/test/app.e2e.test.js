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
  // CHROMIUM_PATH lets the suite run against a browser Playwright didn't install itself
  // (a CI image, or a container whose bundled build doesn't match this Playwright).
  const executablePath = process.env.CHROMIUM_PATH;
  browser = await chromium.launch(executablePath ? { executablePath, args: ["--no-sandbox"] } : {});
});

test.after(async () => {
  await browser.close();
  server.close();
});

const seedWeek = () => {
  const d = new Date();
  const q = (n) => String(n).padStart(2, "0");
  const ymd = (x) => `${x.getFullYear()}-${q(x.getMonth() + 1)}-${q(x.getDate())}`;
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const day = (i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return ymd(x); };
  localStorage.setItem("donna_plan", JSON.stringify({
    fixed: [{ id: "f1", title: "School", days: [1, 2, 3, 4, 5], start: "08:00", end: "14:30" }],
    blocks: [{ id: "b1", itemId: "i1", title: "Rust ownership", date: day(0), start: "19:00", minutes: 60, done: false }],
    sweptOn: ymd(d),
  }));
  localStorage.setItem("nudge_items", JSON.stringify([
    { id: "i1", title: "Learn Rust", category: "skill", status: "active", deadline: `${day(6)}T23:00:00`, createdAt: `${ymd(d)}T08:00:00`, nudges: [] },
  ]));
};

test("the week draws booked sessions and fixed commitments where they actually fall", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedWeek);
  await page.goto(base);

  await assert.doesNotReject(page.getByText("Rust ownership").waitFor(), "the session is drawn");
  await assert.doesNotReject(page.getByText("School").first().waitFor(), "fixed commitments are drawn behind it");
  assert.equal(await page.getByRole("button", { name: /Everything/ }).count(), 0, "the old dashboard is gone");

  await context.close();
});

test("clicking a session ticks it off, and clicking again puts it back", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedWeek);
  await page.goto(base);

  const session = page.getByRole("button", { name: /Rust ownership/ });
  await session.click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).blocks[0].done === true);

  await session.click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).blocks[0].done === false);

  await context.close();
});

test("the week steps forward and comes back to today", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedWeek);
  await page.goto(base);

  const heading = page.locator("h1");
  assert.equal(await heading.innerText(), "This week");

  await page.getByRole("button", { name: "Next week" }).click();
  assert.notEqual(await heading.innerText(), "This week", "the heading names the week you moved to");

  await page.getByRole("button", { name: "This week" }).click();
  assert.equal(await heading.innerText(), "This week");

  await context.close();
});

test("the chatbox under the calendar answers the brief without calling the model", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let modelCalls = 0;
  await page.route("http://127.0.0.1:11434/api/chat", async (route) => { modelCalls++; await route.abort(); });
  await page.addInitScript(seedWeek);
  await page.goto(base);

  await page.getByRole("button", { name: "brief" }).click();

  await assert.doesNotReject(page.getByText(/free|day's gone|booked/i).first().waitFor());
  assert.equal(modelCalls, 0);

  await context.close();
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
  assert.equal(await page.getByLabel("Tell Donna").count(), 0, "nothing but the circle at rest");

  await page.getByRole("button", { name: "Ask Donna" }).click();
  await assert.doesNotReject(page.getByLabel("Tell Donna").waitFor());

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

  const input = page.getByLabel("Tell Donna");
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

  const input = page.getByLabel("Tell Donna");
  // deliberately vague: anything with a clock time on it books instantly and never
  // reaches the model, which is the whole point of the fast path.
  await input.fill("i wanna get better at rust");
  await input.press("Enter");

  await assert.doesNotReject(page.getByText(/ollama isn't running/).waitFor());
  await context.close();
});

test("a fired reminder waits in the orb until it is ticked off", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    localStorage.setItem("donna_plan", JSON.stringify({
      blocks: [], fixed: [], sweptOn: date,
      reminders: [
        { id: "r1", text: "Put the washing on", at: Date.now() - 60_000, done: false },
        { id: "r2", text: "Charge headphones", at: Date.now() + 3_600_000, done: false },
      ],
    }));
  });
  await page.goto(base + "?view=orb");

  // it opens itself; the resting circle with its dot is what you get after dismissing
  await assert.doesNotReject(page.getByText("Put the washing on").waitFor());
  assert.equal(await page.getByText("Charge headphones").count(), 0, "one that hasn't come due yet stays quiet");

  await page.getByRole("button", { name: "Done: Put the washing on" }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).reminders[0].done === true);

  await context.close();
});

test("a reminder pops the orb open by itself, and dismissing leaves the dot", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    localStorage.setItem("donna_plan", JSON.stringify({
      blocks: [], fixed: [], sweptOn: `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`,
      reminders: [{ id: "r1", text: "Put the washing on", at: Date.now() - 60_000, done: false }],
    }));
  });
  await page.goto(base + "?view=orb");

  await assert.doesNotReject(page.getByText("Put the washing on").waitFor(), "it opened without being clicked");

  await page.keyboard.press("Escape");
  await assert.doesNotReject(page.getByRole("button", { name: /1 waiting/ }).waitFor(), "dismissed back to a dot");
  assert.equal(await page.getByText("Put the washing on").count(), 0);

  await page.getByRole("button", { name: /Ask Donna/ }).click();
  await assert.doesNotReject(page.getByText("Put the washing on").waitFor(), "clicking brings it back");

  await context.close();
});

test("a reminder whose moment arrives pops the orb open with nobody touching it", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    localStorage.setItem("donna_plan", JSON.stringify({
      blocks: [], fixed: [], sweptOn: `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`,
      // not due yet when the page loads: it comes due while the orb sits there
      reminders: [{ id: "r1", text: "Take the bins out", at: Date.now() + 2_000, done: false }],
    }));
  });
  await page.goto(base + "?view=orb");

  assert.equal(await page.getByText("Take the bins out").count(), 0, "nothing shown before its time");

  await assert.doesNotReject(
    page.getByText("Take the bins out").waitFor({ timeout: 30_000 }),
    "the orb's own clock brought it up without a click",
  );

  await context.close();
});

test("the orb wakes again every time the window is shown, not just the first time", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + "?view=orb");

  const started = () => page.evaluate(() => {
    const orb = document.querySelector(".orb");
    return orb ? orb.getAnimations().map((a) => a.startTime).join() : null;
  });

  const first = await started();
  assert.notEqual(first, null, "the orb animates on first show");

  // Tauri hides the window rather than unmounting the page; the browser reports the same
  // visibilitychange, so this is the exact signal the component keys off.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(60);

  assert.notEqual(await started(), first, "it animates again on the next show");

  await context.close();
});

test("things with no time booked are visible in the orb, not just sitting in storage", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    const far = new Date(Date.now() + 12 * 86_400_000);
    localStorage.setItem("donna_plan", JSON.stringify({
      fixed: [], reminders: [], sweptOn: date,
      blocks: [{ id: "b1", itemId: "i2", title: "Physics", date, start: "19:00", minutes: 60, done: false }],
    }));
    localStorage.setItem("nudge_items", JSON.stringify([
      { id: "i1", title: "Learn Rust", category: "skill", status: "active", deadline: far.toISOString(), createdAt: `${date}T08:00:00`, nudges: [] },
      { id: "i2", title: "Physics pset", category: "task", status: "active", deadline: far.toISOString(), createdAt: `${date}T08:00:00`, nudges: [] },
      { id: "i3", title: "Old essay", category: "task", status: "done", deadline: far.toISOString(), createdAt: `${date}T08:00:00`, nudges: [] },
    ]));
  });
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();

  await assert.doesNotReject(page.getByText("Learn Rust").waitFor(), "nothing booked against it, so it is shown");
  assert.equal(await page.getByText("Physics pset").count(), 0, "this one has a session booked");
  assert.equal(await page.getByText("Old essay").count(), 0, "finished things stay out of it");
  await assert.doesNotReject(page.getByRole("button", { name: "plan" }).waitFor(), "and you can hand it to Donna");

  await context.close();
});

test("a long goal has its runway topped back up by the daily sweep", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    localStorage.setItem("donna_plan", JSON.stringify({
      // swept yesterday, and the goal has run down to a single session
      fixed: [], reminders: [], sweptOn: "2000-01-01",
      blocks: [{ id: "b1", itemId: "g1", title: "Rust", date, start: "19:00", minutes: 60, done: false }],
    }));
    localStorage.setItem("nudge_items", JSON.stringify([{
      id: "g1", title: "Learn Rust", category: "skill", status: "active",
      deadline: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      createdAt: `${date}T08:00:00`, minutesPerDay: 60, nudges: [],
    }]));
  });
  await page.goto(base);

  await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).blocks.length > 1, null, { timeout: 15_000 });
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem("donna_plan")));

  assert.ok(plan.blocks.length > 10, `expected a fortnight of runway, got ${plan.blocks.length}`);
  assert.ok(plan.blocks.every((b) => b.itemId === "g1"));
  assert.equal(new Set(plan.blocks.map((b) => b.date)).size, plan.blocks.length, "one session a day, never two");

  await context.close();
});
