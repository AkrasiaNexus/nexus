import test from "node:test";
import assert from "node:assert/strict";
import { blockStartMs, dueReminders, LEAD_MINUTES, startingSoon, leadFor } from "../src/lib/reminders.js";

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

// A session about to start is held up until it is answered: on it, skip, or something else.
test("a session is up from five minutes before it starts until it ends or is answered", () => {
  const block = { id: "b1", title: "Call mum", date: "2099-01-08", start: "15:14", minutes: 30, done: false };
  const at = (h, m) => new Date(2099, 0, 8, h, m).getTime();

  assert.deepEqual(startingSoon([block], at(15, 8)), []);
  assert.deepEqual(startingSoon([block], at(15, 9)).map((b) => b.id), ["b1"]);
  assert.deepEqual(startingSoon([block], at(15, 30)).map((b) => b.id), ["b1"], "still up once started");
  assert.deepEqual(startingSoon([block], at(15, 44)), [], "over");
  assert.deepEqual(startingSoon([{ ...block, done: true }], at(15, 10)), []);
  assert.deepEqual(startingSoon([{ ...block, answered: true }], at(15, 10)), []);
});

// How far ahead it was set decides the warning: a thing due in minutes arrives on its minute,
// one set hours ahead gives you time to get ready.
test("the warning depends on how far ahead it was set", () => {
  const due = at("19:00");
  assert.equal(leadFor(due, due - 5 * MIN), 0, "in 5 mins: on the minute");
  assert.equal(leadFor(due, due - 44 * MIN), 0);
  assert.equal(leadFor(due, due - 45 * MIN), 5);
  assert.equal(leadFor(due, due - 120 * MIN), 5);
  assert.equal(leadFor(due, due - 121 * MIN), 10, "over two hours: ten before");
  assert.equal(leadFor(due, undefined, 5), 5, "saved before this existed: as it was");
});

test("a session booked minutes ahead speaks on its start, not before", () => {
  const b = block({ setAt: at("18:50") });

  assert.deepEqual(dueReminders([b], at("18:54"), at("18:56")), []);
  assert.deepEqual(dueReminders([b], at("18:59"), at("19:00")).map((d) => d.id), ["b1"]);
  assert.deepEqual(startingSoon([b], at("18:58")), []);
  assert.deepEqual(startingSoon([b], at("19:00")).map((d) => d.id), ["b1"]);
});

test("a session booked hours ahead speaks ten minutes before", () => {
  const b = block({ setAt: at("12:00") });

  assert.deepEqual(dueReminders([b], at("18:49"), at("18:50")).map((d) => d.id), ["b1"]);
  assert.deepEqual(startingSoon([b], at("18:50")).map((d) => d.id), ["b1"]);
});
