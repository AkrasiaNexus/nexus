import test from "node:test";
import assert from "node:assert/strict";
import { toMin, fromMin, addDays, isYmd, parseYmd } from "../src/lib/time.js";
import { busyOn, freeSlots, findClash } from "../src/lib/schedule.js";

const DATE = "2026-11-24";
const WD = parseYmd(DATE).getDay();

function state(overrides = {}) {
  return {
    fixed: [{ id: "school", title: "School", days: [WD], start: "08:00", end: "14:00" }],
    blocks: [],
    ...overrides,
  };
}

test("toMin and fromMin round-trip a clock time", () => {
  assert.equal(toMin("19:30"), 19 * 60 + 30);
  assert.equal(fromMin(19 * 60 + 30), "19:30");
  assert.equal(fromMin(toMin("07:05")), "07:05");
});

test("toMin rejects anything that is not HH:MM", () => {
  assert.throws(() => toMin("7pm"));
  assert.throws(() => toMin("25:00"));
  assert.throws(() => toMin("10:75"));
});

test("addDays crosses a month boundary", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("isYmd accepts a real date and rejects junk", () => {
  assert.equal(isYmd("2026-11-24"), true);
  assert.equal(isYmd("24-11-2026"), false);
  assert.equal(isYmd("tomorrow"), false);
});

test("busyOn lists a fixed commitment only on the weekdays it runs", () => {
  const s = state();

  assert.deepEqual(
    busyOn(s, DATE).map((b) => [b.title, b.s, b.e]),
    [["School", 480, 840]],
  );
  assert.deepEqual(busyOn(s, addDays(DATE, 1)), []);
});

test("busyOn merges booked blocks with fixed commitments in time order", () => {
  const s = state({ blocks: [{ id: "b1", title: "Rust", date: DATE, start: "19:00", minutes: 60 }] });

  assert.deepEqual(
    busyOn(s, DATE).map((b) => b.title),
    ["School", "Rust"],
  );
});

test("freeSlots returns the gaps either side of a fixed commitment", () => {
  const s = state();

  const slots = freeSlots(s, DATE, 60, toMin("07:00"), toMin("23:00"), false);

  assert.deepEqual(slots, [
    { date: DATE, start: "07:00", end: "08:00" },
    { date: DATE, start: "14:00", end: "23:00" },
  ]);
});

test("freeSlots skips a gap shorter than the minutes asked for", () => {
  const s = state({
    fixed: [
      { id: "school", title: "School", days: [WD], start: "08:00", end: "14:00" },
      { id: "gym", title: "Gym", days: [WD], start: "14:30", end: "15:30" },
    ],
  });

  const slots = freeSlots(s, DATE, 60, toMin("07:00"), toMin("23:00"), false);

  // the 14:00-14:30 gap between school and gym is too short to appear
  assert.deepEqual(slots, [
    { date: DATE, start: "07:00", end: "08:00" },
    { date: DATE, start: "15:30", end: "23:00" },
  ]);
});

test("freeSlots respects an earliest time later than the last commitment", () => {
  const s = state();

  const slots = freeSlots(s, DATE, 30, toMin("20:00"), toMin("23:00"), false);

  assert.deepEqual(slots, [{ date: DATE, start: "20:00", end: "23:00" }]);
});

test("findClash reports the commitment a proposed block overlaps", () => {
  const s = state();

  const hit = findClash(s, DATE, toMin("13:00"), 60);

  assert.equal(hit.title, "School");
});

test("findClash passes a block that butts up against a commitment without overlapping", () => {
  const s = state();

  assert.equal(findClash(s, DATE, toMin("14:00"), 60), undefined);
});

test("findClash ignores the block being moved so it does not clash with itself", () => {
  const s = state({ blocks: [{ id: "b1", title: "Rust", date: DATE, start: "19:00", minutes: 60 }] });

  assert.equal(findClash(s, DATE, toMin("19:00"), 60, "b1"), undefined);
  assert.equal(findClash(s, DATE, toMin("19:00"), 60).title, "Rust");
});
