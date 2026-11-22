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
    events: [{ id: "ics:tuition:1", title: "Physics tuition", date: day(0), start: "16:00", minutes: 90 }],
    sweptOn: ymd(d),
    // Already fresh, so the ticker does not try to fetch a feed inside the test.
    calendarAt: Date.now(),
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
  await assert.doesNotReject(page.getByText("Physics tuition").waitFor(), "so is what the subscribed calendar says");
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
      // askedOn is set because that 19:00 session is already over: without it the evening
      // question pops the orb open on its own after 21:00 and there is no circle left to
      // click, which made this test pass or fail depending on the time of day.
      fixed: [], reminders: [], sweptOn: date, askedOn: date,
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

test("in the evening Donna asks about what you didn't get to, unprompted", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    // Pin the clock to 21:30 so the test does not depend on when it happens to run.
    // nowMin() reads these two; today() reads the date parts, which are left alone.
    Date.prototype.getHours = () => 21;
    Date.prototype.getMinutes = () => 30;

    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    localStorage.setItem("donna_plan", JSON.stringify({
      fixed: [], reminders: [], sweptOn: date, askedOn: null,
      blocks: [
        { id: "b1", itemId: null, title: "Rust ownership", date, start: "19:00", minutes: 60, done: false },
        { id: "b2", itemId: null, title: "Evening run", date, start: "21:15", minutes: 40, done: false },
      ],
    }));
  });
  await page.goto(base + "?view=orb");

  await assert.doesNotReject(page.getByText("did you get to these?").waitFor(), "it asks without being opened");
  await assert.doesNotReject(page.getByText("Rust ownership").waitFor(), "the one that finished at 20:00");
  assert.equal(await page.getByText("Evening run").count(), 0, "the one still running is not asked about yet");

  await page.getByRole("button", { name: "Done: Rust ownership" }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).blocks[0].done === true);

  await context.close();
});

test("what Donna remembers survives a restart and goes back into her prompt", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const replies = [
    { content: "", tool_calls: [{ function: { name: "remember", arguments: { text: "codes best late in the evening" } } }] },
    { content: "noted." },
  ];
  const sent = [];
  await page.route("http://127.0.0.1:11434/api/chat", async (route) => {
    sent.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: replies.shift() ?? { content: "ok" } }) });
  });
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();

  const input = page.getByLabel("Tell Donna");
  await input.fill("i code best late in the evening");
  await input.press("Enter");

  await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).memories?.length === 1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("donna_plan")).memories[0]);
  assert.equal(stored.text, "codes best late in the evening");

  // reload: she still knows it, and it is in what she is sent next time
  await page.reload();
  await page.getByRole("button", { name: /Ask Donna/ }).click();
  await page.getByLabel("Tell Donna").fill("when should i do rust");
  await page.getByLabel("Tell Donna").press("Enter");
  await page.waitForFunction(() => true);
  await page.waitForTimeout(500);

  const system = sent.at(-1).messages[0].content;
  assert.match(system, /codes best late in the evening/, "she is told what she knows");

  await context.close();
});

test("she raises profile work against real free time, before being asked", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    Date.prototype.getHours = () => 9;
    Date.prototype.getMinutes = () => 0;
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString();
    localStorage.setItem("donna_plan", JSON.stringify({ fixed: [], blocks: [], reminders: [], memories: [], sweptOn: date, askedOn: date }));
    localStorage.setItem("nudge_items", JSON.stringify([
      { id: "g1", title: "Learn Rust", category: "skill", status: "active", deadline: inDays(14), createdAt: `${date}T08:00:00`, minutesPerDay: 60, priority: "high", nudges: [] },
      { id: "pf", title: "Portfolio site", category: "idea", status: "active", deadline: inDays(21), createdAt: `${date}T08:00:00`, minutesPerDay: 90, priority: "low", forProfile: true, nudges: [] },
    ]));
  });
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();

  await assert.doesNotReject(page.getByText(/gets you in/).waitFor(), "the profile reason, in her register");
  await assert.doesNotReject(page.getByRole("button", { name: "book it" }).first().waitFor());

  const lines = await page.locator("li").allInnerTexts();
  assert.ok(lines[0].includes("portfolio"), `profile work leads despite being low priority, got: ${lines[0]}`);
  assert.equal(await page.getByText("NOTHING BOOKED").count(), 0, "a proposal supersedes the bare list");

  await context.close();
});

test("she calls out a weekday you never deliver on, unprompted", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    Date.prototype.getHours = () => 9;
    Date.prototype.getMinutes = () => 0;
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const ymd = (x) => `${x.getFullYear()}-${q(x.getMonth() + 1)}-${q(x.getDate())}`;
    const back = (n) => { const x = new Date(d); x.setDate(d.getDate() - n); return ymd(x); };
    const blocks = [7, 14, 21].map((n, i) => ({ id: `b${i}`, itemId: "g1", title: "Gym", date: back(n), start: "18:00", minutes: 60, done: false }));
    localStorage.setItem("donna_plan", JSON.stringify({ fixed: [], blocks, reminders: [], memories: [], sweptOn: ymd(d), askedOn: ymd(d) }));
    localStorage.setItem("nudge_items", JSON.stringify([{
      id: "g1", title: "Gym", category: "habit", status: "active",
      deadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      createdAt: `${back(25)}T08:00:00`, minutesPerDay: 60, priority: "medium", nudges: [],
    }]));
  });
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();

  await assert.doesNotReject(page.getByText(/want me to stop booking/).waitFor(), "she offers to act on what she noticed");
  const said = (await page.locator("li").allInnerTexts()).join(" ");
  assert.match(said, /3 .*booked for gym, 3 missed/i, "she names the count, not a vague feeling");

  await context.close();
});

test("she researches overnight on her own and reads it out in the morning", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let searches = 0;
  await page.route("https://api.firecrawl.dev/v2/search", async (route) => {
    searches++;
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, data: { web: [
        { url: "https://math.mit.edu/primes", title: "MIT PRIMES 2099", description: "Free research program. Applications close January 10, 2099." },
      ] } }),
    });
  });
  await page.addInitScript(() => {
    Date.prototype.getHours = () => 22;
    Date.prototype.getMinutes = () => 30;
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    localStorage.setItem("donna_search_key", "test-key");
    localStorage.setItem("donna_plan", JSON.stringify({
      fixed: [], blocks: [], reminders: [], memories: [], findings: [],
      sweptOn: date, askedOn: date, researchedOn: null,
    }));
    localStorage.setItem("nudge_items", JSON.stringify([{
      id: "g1", title: "Learn Rust", category: "skill", status: "active",
      deadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      createdAt: `${date}T08:00:00`, minutesPerDay: 60, priority: "high", nudges: [],
    }]));
  });

  // the main window runs the ticker; nobody asked it to do any of this
  await page.goto(base);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).researchedOn !== null, null, { timeout: 20_000 });

  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem("donna_plan")));
  assert.ok(searches > 0, "she went looking without being asked");
  assert.equal(plan.findings.length, 1);
  assert.equal(plan.findings[0].deadline, "2099-01-10", "the deadline is a field, read once");

  await context.close();
});

test("she offers to block time for a deadline she found, and booking it clears the offer", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    Date.prototype.getHours = () => 9;
    Date.prototype.getMinutes = () => 0;
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    const closes = new Date(Date.now() + 10 * 86_400_000);
    localStorage.setItem("donna_plan", JSON.stringify({
      fixed: [], blocks: [], reminders: [], memories: [], sweptOn: date, askedOn: date, researchedOn: date,
      findings: [{
        id: "primes", title: "MIT PRIMES", url: "https://e/primes",
        deadline: `${closes.getFullYear()}-${q(closes.getMonth() + 1)}-${q(closes.getDate())}`,
        note: "", foundOn: date,
      }],
    }));
    localStorage.setItem("nudge_items", "[]");
  });
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();

  await assert.doesNotReject(page.getByText(/MIT PRIMES closes/).waitFor(), "she raises it with the date");
  await page.getByRole("button", { name: "block it" }).click();

  await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).blocks.length === 1);
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem("donna_plan")));
  assert.match(plan.blocks[0].title, /Apply: MIT PRIMES/);
  assert.equal(plan.blocks[0].minutes, 90);
  assert.equal(plan.findings[0].handled, true, "she doesn't offer the same thing twice");
  assert.equal(await page.getByText(/MIT PRIMES closes/).count(), 0, "and the offer goes away");

  await context.close();
});

// Whatever is already saved on a real machine came from older versions of this app, a crash,
// or a hand edit. None of it may take the window down: a blank white window was seen on the
// first real desktop run, and bad saved data produces exactly that.
const CORRUPT = {
  "nothing saved at all, a first install": {},
  "items are null": { nudge_items: "null" },
  "items are an object, not a list": { nudge_items: "{}" },
  "items are not JSON": { nudge_items: "not json at all" },
  "items hold junk entries": { nudge_items: JSON.stringify([null, 5, "x", { id: "a" }, { id: "b", title: "No deadline", status: "active" }]) },
  "plan is null": { donna_plan: "null" },
  "plan is a list": { donna_plan: "[1,2,3]" },
  "plan is not JSON": { donna_plan: "{broken" },
  "plan fields have the wrong types": { donna_plan: JSON.stringify({ blocks: null, fixed: "school", events: 5, reminders: {}, memories: "x", findings: null }) },
  "plan entries are missing fields": {
    donna_plan: JSON.stringify({
      blocks: [null, { id: "b1" }, { id: "b2", title: "Half", date: "2026-11-24" }, { id: "b3", title: "Bad", date: "not a date", start: "25:99", minutes: -5 }],
      fixed: [{ id: "f1" }, { id: "f2", title: "School", days: "weekdays", start: "08:00", end: "14:00" }],
      events: [{ id: "e1" }, { title: "Bad", date: "2026-11-24", start: "nope", minutes: "lots" }],
    }),
  },
};

for (const [name, seed] of Object.entries(CORRUPT)) {
  for (const view of ["", "?view=orb"]) {
    test(`the ${view ? "orb" : "week"} still draws when saved data is broken: ${name}`, async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.addInitScript((pairs) => {
        for (const [key, value] of Object.entries(pairs)) localStorage.setItem(key, value);
      }, seed);

      await page.goto(base + view);
      await page.waitForTimeout(800);

      assert.deepEqual(errors, [], "nothing threw");
      const drawn = view
        ? await page.getByRole("button", { name: /Ask Donna|Donna/ }).count()
        : await page.getByText(/This week|Nov|Dec|Jan/).count();
      assert.ok(drawn > 0, "and something was drawn, not a blank window");
      await context.close();
    });
  }
}

// The first thing anyone tries. Every reminder test above seeded storage directly, so typing
// one into the box had never been run end to end.
async function chatbox(page) {
  await page.addInitScript(() => {
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    localStorage.setItem("donna_plan", JSON.stringify({ sweptOn: date, askedOn: date, calendarAt: Date.now() }));
  });
  await page.goto(base);
  return page.getByLabel("Tell Donna");
}
// A plan nobody has written since it was seeded has no reminders key at all: that is "none".
// Reading it raw passed only after 22:00, when the overnight research happened to write the plan.
const savedReminders = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("donna_plan")).reminders ?? []);

test("typing a reminder saves it on the real clock and says when, without the model", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let modelCalls = 0;
  await page.route("http://127.0.0.1:11434/**", (route) => { modelCalls++; return route.abort(); });
  const input = await chatbox(page);

  const before = Date.now();
  await input.fill("remind me to call mum in 20 mins");
  await input.press("Enter");

  await assert.doesNotReject(page.getByText("got it. call mum — i'll say in 20 mins.").waitFor());
  const [saved] = await savedReminders(page);
  assert.equal(saved.text, "Call mum");
  assert.ok(Math.abs(saved.at - (before + 20 * 60_000)) < 5_000, "twenty minutes from now, on the real clock");
  assert.equal(modelCalls, 0, "a reminder never waits on the model");
  await context.close();
});

test("a reminder with no time asks when, and the next message finishes it", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("http://127.0.0.1:11434/**", (route) => route.abort());
  const input = await chatbox(page);

  await input.fill("remind me to call mum");
  await input.press("Enter");
  await assert.doesNotReject(page.getByText("when?", { exact: true }).waitFor());
  assert.deepEqual(await savedReminders(page), [], "nothing is saved with no time to fire at");

  await input.fill("in 45 mins");
  await input.press("Enter");
  await assert.doesNotReject(page.getByText("got it. call mum — i'll say in 45 mins.").waitFor());
  const [saved] = await savedReminders(page);
  assert.equal(saved.text, "Call mum");
  await context.close();
});

test("a reminder for tomorrow is saved for tomorrow, and she says the day", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("http://127.0.0.1:11434/**", (route) => route.abort());
  const input = await chatbox(page);

  await input.fill("remind me to call mum tomorrow at 9am");
  await input.press("Enter");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][tomorrow.getDay()];
  await assert.doesNotReject(page.getByText(`got it. call mum — i'll say ${day} 9am.`).waitFor());
  const [saved] = await savedReminders(page);
  assert.equal(new Date(saved.at).getDate(), tomorrow.getDate(), "tomorrow — it used to fire today");
  assert.equal(new Date(saved.at).getHours(), 9);
  await context.close();
});

test("a reminder fires on its moment, not on whichever minute-tick comes after it", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    // Record what the system notification would have said.
    window.__fired = [];
    window.Notification = class {
      static permission = "granted";
      static requestPermission() { return Promise.resolve("granted"); }
      constructor(title, { body } = {}) { window.__fired.push({ body, at: Date.now() }); }
    };
    const d = new Date();
    const q = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
    localStorage.setItem("donna_plan", JSON.stringify({
      sweptOn: date, askedOn: date, calendarAt: Date.now(),
      reminders: [{ id: "r1", text: "Take the bins out", at: Date.now() + 4_000, done: false }],
    }));
  });
  await page.route("http://127.0.0.1:11434/**", (route) => route.abort());
  await page.goto(base);

  await page.waitForFunction(() => window.__fired.some((n) => n.body === "Take the bins out"), null, { timeout: 15_000 });
  const fired = await page.evaluate(() => window.__fired.find((n) => n.body === "Take the bins out").at);
  const due = await page.evaluate(() => JSON.parse(localStorage.getItem("donna_plan")).reminders[0].at);
  assert.ok(fired - due < 3_000, `fired ${fired - due}ms after it was due — the minute tick alone could be 60s late`);
  await context.close();
});

test("a reminder typed now is aimed at straight away, not left for the next minute-tick", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__fired = [];
    window.Notification = class {
      static permission = "granted";
      static requestPermission() { return Promise.resolve("granted"); }
      constructor(title, { body } = {}) { window.__fired.push({ body, at: Date.now() }); }
    };
  });
  await page.route("http://127.0.0.1:11434/**", (route) => route.abort());
  const input = await chatbox(page);

  // "in 1 min" is the shortest thing anyone types when checking this works.
  await input.fill("remind me to stretch in 1 min");
  await input.press("Enter");
  const due = await page.waitForFunction(() => JSON.parse(localStorage.getItem("donna_plan")).reminders?.[0]?.at).then((h) => h.jsonValue());

  await page.waitForFunction(() => window.__fired.some((n) => n.body === "Stretch"), null, { timeout: 90_000 });
  const fired = await page.evaluate(() => window.__fired.find((n) => n.body === "Stretch").at);
  assert.ok(fired - due < 3_000, `fired ${fired - due}ms after it was due`);
  await context.close();
});

// More detail, same calendar: everything below is drawn on the week itself, in grey, and the
// summary line exists only when there is something to say.
const seedDetail = () => {
  const d = new Date();
  const q = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
  const later = new Date(d);
  later.setDate(d.getDate() + 3);
  localStorage.setItem("donna_plan", JSON.stringify({
    sweptOn: date, askedOn: date, calendarAt: Date.now(),
    blocks: [{ id: "b1", itemId: "essay", title: "Essay draft", date, start: "15:00", minutes: 60, done: false }],
    reminders: [{ id: "r1", text: "Call mum", at: new Date(`${date}T17:30:00`).getTime(), done: false }],
  }));
  localStorage.setItem("nudge_items", JSON.stringify([
    { id: "essay", title: "Essay", category: "task", status: "active", priority: "high", deadline: `${date}T18:00:00`, createdAt: `${date}T08:00:00`, nudges: [] },
    { id: "rust", title: "Learn Rust", category: "skill", status: "active", deadline: later.toISOString(), createdAt: `${date}T08:00:00`, nudges: [] },
  ]));
};

test("a deadline is drawn on the day and at the time it falls", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedDetail);
  await page.goto(base);

  await assert.doesNotReject(page.getByText("due · Essay").waitFor(), "the deadline is on the calendar");
  await context.close();
});

test("a reminder is drawn at its time, and says what it is", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedDetail);
  await page.goto(base);

  await assert.doesNotReject(page.getByRole("img", { name: /reminder 5:30pm — call mum/i }).waitFor());
  await context.close();
});

test("a session says which goal it serves and how close that goal is", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedDetail);
  await page.goto(base);

  const title = await page.getByRole("button", { name: /Essay draft/ }).getAttribute("title");
  assert.match(title, /for Essay/);
  assert.match(title, /high priority/);
  assert.match(title, /due today/);
  await context.close();
});

test("a goal with no time booked is named under the header", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedDetail);
  await page.goto(base);

  await assert.doesNotReject(page.getByText("not booked: Learn Rust").waitFor());
  await context.close();
});

test("with everything booked there is no summary line at all", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedWeek);
  await page.goto(base);

  await page.getByText("Rust ownership").waitFor();
  assert.equal(await page.getByText(/not booked:/).count(), 0, "clean when there is nothing to say");
  await context.close();
});

// A stand-in for the Tauri bridge, so the orb's calls to the desktop side can be seen.
const fakeTauri = () => {
  window.__calls = [];
  window.__TAURI_INTERNALS__ = {
    invoke: (cmd, args) => { window.__calls.push({ cmd, args }); return Promise.resolve(null); },
    transformCallback: () => 0,
    metadata: { currentWindow: { label: "orb" }, currentWebview: { windowLabel: "orb", label: "orb" } },
  };
};
const seedOrbCard = () => {
  const d = new Date();
  const q = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`;
  const later = new Date(d); later.setDate(d.getDate() + 6);
  localStorage.setItem("donna_plan", JSON.stringify({ sweptOn: date, askedOn: date, calendarAt: Date.now() }));
  localStorage.setItem("nudge_items", JSON.stringify([
    { id: "g1", title: "Go gym 4 times a week", category: "habit", status: "active", deadline: later.toISOString(), createdAt: `${date}T08:00:00`, nudges: [] },
  ]));
};

test("the orb's window is sized to the card's full height, not its height mid-animation", async () => {
  // The card opens from scale(.86). Measured with getBoundingClientRect, the window was made
  // 14% short, so the card scrolled, its top was clipped, and a scrollbar showed.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(fakeTauri);
  await page.addInitScript(seedOrbCard);
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();
  await page.waitForTimeout(900);

  const { asked, needed } = await page.evaluate(() => {
    const sizes = window.__calls.filter((c) => c.cmd === "resize_orb");
    const card = document.querySelector(".orb-card");
    return { asked: sizes.at(-1)?.args.height, needed: card.offsetHeight + 24 };
  });
  assert.ok(asked >= needed, `asked for ${asked}px, the card needs ${needed}px`);
  await context.close();
});

test("the orb never shows a page scrollbar", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(seedOrbCard);
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();

  const overflow = await page.evaluate(() => [getComputedStyle(document.documentElement).overflow, getComputedStyle(document.body).overflow]);
  assert.deepEqual(overflow, ["hidden", "hidden"]);
  await context.close();
});

test("the orb opens the calendar", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(fakeTauri);
  await page.addInitScript(seedOrbCard);
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();

  await page.getByRole("button", { name: "week" }).click();
  await page.waitForFunction(() => window.__calls.some((c) => c.cmd === "open_calendar"));
  await context.close();
});

// Idle means: the pointer is off the orb, nothing is half-typed, and she isn't thinking.
const openOrbForIdle = async (page) => {
  await page.addInitScript(fakeTauri);
  await page.addInitScript(seedOrbCard);
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();
};
const leave = (page) => page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave")));
const dismissed = (page) => page.evaluate(() => window.__calls.some((c) => c.cmd === "dismiss_orb"));

test("the orb goes away after four seconds of nothing", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openOrbForIdle(page);
  await leave(page);

  await page.waitForTimeout(3000);
  assert.equal(await dismissed(page), false, "not before four seconds");
  await page.waitForTimeout(1600);
  assert.equal(await dismissed(page), true, "gone after four");
  await context.close();
});

test("the orb stays while the pointer rests on it", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openOrbForIdle(page);
  await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseenter")));

  await page.waitForTimeout(5000);
  assert.equal(await dismissed(page), false, "hovering is how you keep it open to read");
  await context.close();
});

test("the orb never throws away a half-typed message", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openOrbForIdle(page);
  await page.getByLabel("Tell Donna").fill("remind me to call");
  await leave(page);

  await page.waitForTimeout(5000);
  assert.equal(await dismissed(page), false);
  await context.close();
});

test("the orb stays while she is thinking", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("http://127.0.0.1:11434/**", () => new Promise(() => {}));
  await openOrbForIdle(page);
  await page.getByLabel("Tell Donna").fill("gym at 6pm today");
  await page.getByLabel("Tell Donna").press("Enter");
  await leave(page);

  await page.waitForTimeout(5000);
  assert.equal(await dismissed(page), false, "the answer would arrive into a hidden window");
  await context.close();
});

test("a reminder that fired stays up until it is seen", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(fakeTauri);
  await page.addInitScript(() => {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem("donna_plan", JSON.stringify({
      fixed: [], blocks: [], memories: [], sweptOn: date, askedOn: date,
      reminders: [{ id: "r1", text: "Put the washing on", at: Date.now() - 60_000, done: false }],
    }));
  });
  await page.goto(base + "?view=orb");
  await page.getByText("Put the washing on").waitFor();
  await leave(page);

  await page.waitForTimeout(5000);
  assert.equal(await dismissed(page), false, "you may be away from the screen when it fires");
  await context.close();
});

test("hiding the orb under the pointer doesn't stop it going away next time", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openOrbForIdle(page);
  await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseenter")));
  // A hidden window gets no mouseleave, so the pointer was last seen on it.
  await page.evaluate(() => {
    const flip = (state) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    flip("hidden");
    flip("visible");
  });

  await page.waitForTimeout(4600);
  assert.equal(await dismissed(page), true);
  await context.close();
});

// Her clock is set before the page loads, so the hour of day is the test's, not the machine's.
const orbAt = async (page, hour) => {
  const when = new Date();
  when.setHours(hour, 0, 0, 0);
  await page.clock.setFixedTime(when);
  await page.addInitScript(fakeTauri);
  await page.addInitScript(seedOrbCard);
  const sent = [];
  await page.route(OLLAMA_CHAT, async (route) => {
    sent.push(JSON.parse(route.request().postData()));
    await route.fulfill(ollamaSays({ content: "booked." }));
  });
  await page.goto(base + "?view=orb");
  await page.getByRole("button", { name: /Ask Donna/ }).click();
  return sent;
};
const lastUserLine = (body) => body.messages.filter((m) => m.role === "user").at(-1).content;

test("'today at 7' said after 7am goes to the model as 7pm", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const sent = await orbAt(page, 10);

  await page.getByLabel("Tell Donna").fill("i wanna go gym today at 7");
  await page.getByLabel("Tell Donna").press("Enter");
  await page.getByText("booked.").waitFor();

  assert.match(lastUserLine(sent[0]), /today at 7pm/);
  await context.close();
});

test("when 7 could be either, she asks am or pm before touching the week", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const sent = await orbAt(page, 5);

  await page.getByLabel("Tell Donna").fill("gym today at 7");
  await page.getByLabel("Tell Donna").press("Enter");
  await page.getByText("7am or 7pm?").waitFor();
  assert.equal(sent.length, 0, "no model call for a question she can ask herself");

  await page.getByLabel("Tell Donna").fill("pm");
  await page.getByLabel("Tell Donna").press("Enter");
  await page.getByText("booked.").waitFor();
  assert.match(lastUserLine(sent[0]), /gym today at 7pm/);
  await context.close();
});
