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
