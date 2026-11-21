import test from "node:test";
import assert from "node:assert/strict";
import { dailyBrief } from "../src/lib/brief.js";

const DATE = "2099-01-05";
const TOMORROW = "2099-01-06";

const plan = (overrides = {}) => ({ fixed: [], blocks: [], ...overrides });
const item = (overrides = {}) => ({ id: "i1", title: "Physics pset", status: "active", deadline: `${DATE}T18:00:00`, ...overrides });
const block = (overrides = {}) => ({ id: "b1", itemId: null, title: "Rust", date: DATE, start: "20:00", minutes: 60, done: false, ...overrides });

test("a clear day reports the whole working window as free", () => {
  const brief = dailyBrief({ items: [], plan: plan(), date: DATE, nowMinutes: 7 * 60 });

  assert.deepEqual(brief.free, [{ start: "07:00", end: "23:00", minutes: 960 }]);
  assert.equal(brief.freeMinutes, 960);
});

test("free windows are carved around fixed commitments and booked sessions", () => {
  const weekday = new Date(2099, 0, 5).getDay();
  const brief = dailyBrief({
    items: [],
    plan: plan({
      fixed: [{ id: "f1", title: "School", days: [weekday], start: "08:00", end: "14:30" }],
      blocks: [block({ start: "20:00", minutes: 60 })],
    }),
    date: DATE,
    nowMinutes: 7 * 60,
  });

  assert.deepEqual(brief.free.map((f) => `${f.start}-${f.end}`), ["07:00-08:00", "14:30-20:00", "21:00-23:00"]);
});

test("the brief starts from now, not from the top of the day", () => {
  const brief = dailyBrief({ items: [], plan: plan(), date: DATE, nowMinutes: 16 * 60 });

  assert.equal(brief.free[0].start, "16:00");
});

test("gaps too short to use are left out", () => {
  const weekday = new Date(2099, 0, 5).getDay();
  const brief = dailyBrief({
    items: [],
    plan: plan({ fixed: [{ id: "f1", title: "School", days: [weekday], start: "07:20", end: "23:00" }] }),
    date: DATE,
    nowMinutes: 7 * 60,
  });

  assert.deepEqual(brief.free, [], "a 20 minute sliver is not a window");
});

test("what's due today is listed, soonest first, with whether it has time booked", () => {
  const essay = item({ id: "i2", title: "Essay", deadline: `${DATE}T09:00:00` });
  const brief = dailyBrief({
    items: [item(), essay],
    plan: plan({ blocks: [block({ itemId: "i1" })] }),
    date: DATE,
    nowMinutes: 7 * 60,
  });

  assert.deepEqual(brief.due.map((d) => [d.title, d.booked]), [["Essay", false], ["Physics pset", true]]);
});

test("things due another day are not today's problem", () => {
  const brief = dailyBrief({ items: [item({ deadline: `${TOMORROW}T18:00:00` })], plan: plan(), date: DATE, nowMinutes: 7 * 60 });

  assert.deepEqual(brief.due, []);
});

test("a finished session does not count as the thing being covered", () => {
  const brief = dailyBrief({
    items: [item()],
    plan: plan({ blocks: [block({ itemId: "i1", done: true })] }),
    date: DATE,
    nowMinutes: 7 * 60,
  });

  assert.equal(brief.due[0].booked, false);
});

test("sessions still to come today are listed in order", () => {
  const brief = dailyBrief({
    items: [],
    plan: plan({ blocks: [block({ id: "b2", title: "Run", start: "18:00", minutes: 40 }), block()] }),
    date: DATE,
    nowMinutes: 7 * 60,
  });

  assert.deepEqual(brief.next.map((b) => b.title), ["Run", "Rust"]);
});

test("a session already finished is not in what's left", () => {
  const brief = dailyBrief({ items: [], plan: plan({ blocks: [block({ done: true })] }), date: DATE, nowMinutes: 7 * 60 });

  assert.deepEqual(brief.next, []);
});

test("the brief reads as Donna talking, naming the free time and what is due", () => {
  const brief = dailyBrief({
    items: [item()],
    plan: plan({ blocks: [block()] }),
    date: DATE,
    nowMinutes: 16 * 60,
  });

  assert.match(brief.text, /free/i);
  assert.match(brief.text, /Physics pset/);
  assert.doesNotMatch(brief.text, /undefined|NaN|\[object/);
});

test("nothing due and nothing booked still gives a usable sentence", () => {
  const brief = dailyBrief({ items: [], plan: plan(), date: DATE, nowMinutes: 16 * 60 });

  assert.ok(brief.text.length > 0);
  assert.doesNotMatch(brief.text, /undefined|NaN/);
});

test("a day with no time left says so instead of offering an empty list", () => {
  const brief = dailyBrief({ items: [], plan: plan(), date: DATE, nowMinutes: 23 * 60 });

  assert.deepEqual(brief.free, []);
  assert.match(brief.text, /day'?s? (gone|done)|nothing left/i);
});
