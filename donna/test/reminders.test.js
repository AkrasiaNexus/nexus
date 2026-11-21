import test from "node:test";
import assert from "node:assert/strict";
import { blockStartMs, dueReminders, LEAD_MINUTES } from "../src/lib/reminders.js";

const DATE = "2026-11-24";
const MIN = 60_000;

const block = (overrides = {}) => ({ id: "b1", title: "Rust", date: DATE, start: "19:00", minutes: 60, done: false, ...overrides });

const at = (clock) => blockStartMs({ date: DATE, start: clock });

test("blockStartMs turns a date and clock time into a timestamp", () => {
  assert.equal(at("19:00") - at("18:00"), 60 * MIN);
});

test("nothing is due well before the block starts", () => {
  const b = block();

  assert.deepEqual(dueReminders([b], at("18:00"), at("18:30")), []);
});

test("a reminder fires when the lead time is crossed", () => {
  const b = block();
  const lead = at("19:00") - LEAD_MINUTES * MIN;

  const due = dueReminders([b], lead - MIN, lead + MIN);

  assert.deepEqual(due.map((d) => d.id), ["b1"]);
});

test("the same reminder does not fire twice", () => {
  const b = block();
  const lead = at("19:00") - LEAD_MINUTES * MIN;

  dueReminders([b], lead - MIN, lead + MIN);

  assert.deepEqual(dueReminders([b], lead + MIN, lead + 2 * MIN), []);
});

test("a block slept through is not reminded about once it has already ended", () => {
  const b = block();

  const due = dueReminders([b], at("18:00"), at("21:00"));

  assert.deepEqual(due, []);
});

test("a block that started but has not ended is still worth reminding about", () => {
  const b = block();

  const due = dueReminders([b], at("18:00"), at("19:30"));

  assert.deepEqual(due.map((d) => d.id), ["b1"]);
});

test("a block already ticked off stays quiet", () => {
  const b = block({ done: true });
  const lead = at("19:00") - LEAD_MINUTES * MIN;

  assert.deepEqual(dueReminders([b], lead - MIN, lead + MIN), []);
});

test("several blocks coming due are all returned, soonest first", () => {
  const later = block({ id: "b2", title: "Gym", start: "19:30" });
  const soon = block({ id: "b1", start: "19:15" });

  const due = dueReminders([later, soon], at("19:00"), at("19:26"));

  assert.deepEqual(due.map((d) => d.id), ["b1", "b2"]);
});
