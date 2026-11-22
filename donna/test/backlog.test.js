import test from "node:test";
import assert from "node:assert/strict";
import { toMin } from "../src/lib/time.js";
import { rollOverMissed } from "../src/lib/backlog.js";

const TODAY = "2026-11-24";
const TOMORROW = "2026-11-25";

const block = (overrides = {}) => ({ id: "b1", title: "Rust", date: TODAY, start: "19:00", minutes: 60, done: false, ...overrides });
const END_OF_DAY = toMin("23:00");

test("a session missed today moves to the first free slot tomorrow and is flagged backlog", () => {
  const before = { fixed: [], blocks: [block()] };

  const { state, moved } = rollOverMissed(before, TODAY, END_OF_DAY);

  assert.deepEqual(moved.map((b) => b.id), ["b1"]);
  assert.deepEqual(
    state.blocks.map((b) => [b.date, b.start, b.isBacklog]),
    [[TOMORROW, "07:00", true]],
  );
});

test("the sweep does not mutate the state it was given", () => {
  const before = { fixed: [], blocks: [block()] };

  rollOverMissed(before, TODAY, END_OF_DAY);

  assert.equal(before.blocks[0].date, TODAY);
  assert.equal(before.blocks[0].isBacklog, undefined);
});

test("a session already ticked off is left where it is", () => {
  const before = { fixed: [], blocks: [block({ done: true })] };

  const { state, moved } = rollOverMissed(before, TODAY, END_OF_DAY);

  assert.deepEqual(moved, []);
  assert.equal(state.blocks[0].date, TODAY);
});

test("a session still to come today is left alone", () => {
  const before = { fixed: [], blocks: [block({ start: "22:00" })] };

  const { moved } = rollOverMissed(before, TODAY, toMin("21:00"));

  assert.deepEqual(moved, []);
});

test("two missed sessions stack one after the other instead of overlapping", () => {
  const before = { fixed: [], blocks: [block(), block({ id: "b2", title: "Gym", start: "20:00", minutes: 30 })] };

  const { state } = rollOverMissed(before, TODAY, END_OF_DAY);

  assert.deepEqual(
    state.blocks.map((b) => [b.id, b.start, b.minutes]),
    [["b1", "07:00", 60], ["b2", "08:00", 30]],
  );
});

test("a rolled-over session lands around tomorrow's fixed commitments", () => {
  const before = {
    fixed: [{ id: "school", title: "School", days: [0, 1, 2, 3, 4, 5, 6], start: "07:00", end: "14:00" }],
    blocks: [block()],
  };

  const { state } = rollOverMissed(before, TODAY, END_OF_DAY);

  assert.deepEqual(state.blocks.map((b) => [b.date, b.start]), [[TOMORROW, "14:00"]]);
});

test("a session from an earlier day is swept too, whatever the time now", () => {
  const before = { fixed: [], blocks: [block({ date: "2026-11-20" })] };

  const { moved } = rollOverMissed(before, TODAY, toMin("00:30"));

  assert.deepEqual(moved.map((b) => b.id), ["b1"]);
});

test("a session that cannot fit tomorrow stays put but is still flagged backlog", () => {
  const before = {
    fixed: [{ id: "all-day", title: "Camp", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "24:00" }],
    blocks: [block()],
  };

  const { state, moved } = rollOverMissed(before, TODAY, END_OF_DAY);

  assert.deepEqual(moved, []);
  assert.deepEqual(state.blocks.map((b) => [b.date, b.isBacklog]), [[TODAY, true]]);
});

// One missed session a day for the last two weeks, as if the app had not run while away.
const away = (days) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(2026, 10, 24 - days + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return block({ id: `b${i}`, title: `Thing ${i}`, date });
  });

test("coming back after a break does not carpet tomorrow with everything missed", () => {
  // Before the cap, all fourteen landed on one day, 07:00 to 21:00 solid.
  const { state } = rollOverMissed({ fixed: [], blocks: away(14) }, TODAY, toMin("10:00"));

  const tomorrow = state.blocks.filter((b) => b.date === TOMORROW);
  assert.ok(tomorrow.length <= 3, `${tomorrow.length} sessions landed on tomorrow`);
});

test("the most recent misses are the ones carried forward", () => {
  const { moved } = rollOverMissed({ fixed: [], blocks: away(5) }, TODAY, toMin("10:00"));

  assert.deepEqual(moved.map((b) => b.id), ["b2", "b3", "b4"], "the last three, in the order they were meant to happen");
});

test("a miss from more than a week ago is history, left exactly as it was", () => {
  const old = block({ id: "old", date: "2026-11-10" });
  const { state, moved } = rollOverMissed({ fixed: [], blocks: [old] }, TODAY, toMin("10:00"));

  assert.deepEqual(moved, []);
  assert.deepEqual(state.blocks, [old], "not moved, and not flagged as backlog either");
});

test("a session skipped today warns again on the day it is carried to", () => {
  const before = { blocks: [block({ answered: true })], fixed: [] };

  const { moved } = rollOverMissed(before, TODAY, END_OF_DAY);

  assert.equal(moved[0].date, TOMORROW);
  assert.equal(moved[0].answered, false);
});
