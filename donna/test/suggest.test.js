import test from "node:test";
import assert from "node:assert/strict";
import { suggestions } from "../src/lib/suggest.js";
import { addDays } from "../src/lib/time.js";

const MON = "2099-01-05";
const EARLY = 7 * 60;

const goal = (overrides = {}) => ({
  id: "g1", title: "Learn Rust", status: "active",
  deadline: `${addDays(MON, 20)}T23:00:00`, minutesPerDay: 60, priority: "medium", ...overrides,
});
const plan = (blocks = [], fixed = []) => ({ blocks, fixed });
const block = (date, overrides = {}) => ({ id: `b-${date}`, itemId: "g1", title: "Rust", date, start: "19:00", minutes: 60, done: false, ...overrides });

test("a clear day plus something that matters is a suggestion", () => {
  const [first] = suggestions({ items: [goal()], plan: plan(), date: MON, nowMinutes: EARLY });

  assert.equal(first.item.id, "g1");
  assert.ok(first.slot.minutes >= 60);
  assert.ok(first.reason.length > 0);
});

test("nothing is suggested when there is nothing of yours to suggest", () => {
  assert.deepEqual(suggestions({ items: [], plan: plan(), date: MON, nowMinutes: EARLY }), []);
});

test("a day already booked for that goal is not suggested again", () => {
  const booked = Array.from({ length: 6 }, (_, i) => block(addDays(MON, i)));

  assert.deepEqual(suggestions({ items: [goal()], plan: plan(booked), date: MON, nowMinutes: EARLY }), []);
});

test("profile work outranks everything else, whatever its priority", () => {
  const rust = goal({ id: "rust", title: "Learn Rust", priority: "high" });
  const portfolio = goal({ id: "pf", title: "Portfolio site", priority: "low", forProfile: true });

  const [first] = suggestions({ items: [rust, portfolio], plan: plan(), date: MON, nowMinutes: EARLY });

  assert.equal(first.item.id, "pf", "the thing that gets you in comes first");
  assert.match(first.reason, /profile|gets you in|cooked/i);
});

test("with no profile work, the high-priority goal leads", () => {
  const low = goal({ id: "low", priority: "low" });
  const high = goal({ id: "high", priority: "high" });

  assert.equal(suggestions({ items: [low, high], plan: plan(), date: MON, nowMinutes: EARLY })[0].item.id, "high");
});

test("a slot too short for the goal's daily stint is not offered", () => {
  const chunky = goal({ minutesPerDay: 180 });
  const packed = plan([], [{ id: "f1", title: "School", days: [0, 1, 2, 3, 4, 5, 6], start: "08:00", end: "22:30" }]);

  assert.deepEqual(suggestions({ items: [chunky], plan: packed, date: MON, nowMinutes: EARLY }), []);
});

test("finished and skipped goals are never suggested", () => {
  const items = [goal({ status: "done" }), goal({ id: "g2", status: "skipped" })];

  assert.deepEqual(suggestions({ items, plan: plan(), date: MON, nowMinutes: EARLY }), []);
});

test("a goal whose deadline has gone is not suggested", () => {
  const over = goal({ deadline: `${addDays(MON, -1)}T23:00:00` });

  assert.deepEqual(suggestions({ items: [over], plan: plan(), date: MON, nowMinutes: EARLY }), []);
});

test("it offers a couple of things, not a wall of them", () => {
  const many = Array.from({ length: 8 }, (_, i) => goal({ id: `g${i}`, title: `Goal ${i}` }));

  assert.ok(suggestions({ items: many, plan: plan(), date: MON, nowMinutes: EARLY }).length <= 2);
});

test("two suggestions never propose the same slot twice", () => {
  const a = goal({ id: "a", title: "Rust", forProfile: true });
  const b = goal({ id: "b", title: "Portfolio", forProfile: true });

  const out = suggestions({ items: [a, b], plan: plan(), date: MON, nowMinutes: EARLY });

  const slots = out.map((s) => `${s.slot.date} ${s.slot.start}`);
  assert.equal(new Set(slots).size, slots.length);
});

test("the reason says why now, in her register", () => {
  const soon = goal({ deadline: `${addDays(MON, 2)}T23:00:00`, priority: "high" });

  const [first] = suggestions({ items: [soon], plan: plan(), date: MON, nowMinutes: EARLY });

  assert.doesNotMatch(first.reason, /[A-Z]{2,}|!/, "no shouting, no exclamation marks");
  assert.match(first.reason, /\d/, "it names the time or the days left");
});
