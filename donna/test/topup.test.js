import test from "node:test";
import assert from "node:assert/strict";
import { topUpGoals } from "../src/lib/topup.js";
import { addDays } from "../src/lib/time.js";

const MON = "2099-01-05";
const far = addDays(MON, 60);

const goal = (overrides = {}) => ({
  id: "g1", title: "Learn Rust", status: "active",
  deadline: `${far}T23:00:00`, minutesPerDay: 60, ...overrides,
});
const session = (date, overrides = {}) => ({ id: `b-${date}`, itemId: "g1", title: "Rust", date, start: "19:00", minutes: 60, done: false, ...overrides });
const plan = (blocks = []) => ({ fixed: [], blocks });

test("a goal with a far deadline is topped up to a fortnight of runway", () => {
  const { state, added } = topUpGoals(plan(), [goal()], MON);

  assert.equal(added.length, 14, "one session a day across the window");
  assert.equal(state.blocks.length, 14);
  assert.equal(added.at(-1).date, addDays(MON, 13));
});

test("a goal already full is left completely alone", () => {
  const existing = Array.from({ length: 14 }, (_, i) => session(addDays(MON, i)));

  const { added } = topUpGoals(plan(existing), [goal()], MON);

  assert.deepEqual(added, []);
});

test("a day that already has the goal's session is not booked twice", () => {
  const { state, added } = topUpGoals(plan([session(MON)]), [goal()], MON);

  const onMonday = state.blocks.filter((b) => b.date === MON && b.itemId === "g1");
  assert.equal(onMonday.length, 1, "the existing session stands");
  assert.ok(!added.some((b) => b.date === MON));
});

test("nothing is booked past the deadline", () => {
  const soon = goal({ deadline: `${addDays(MON, 3)}T23:00:00` });

  const { added } = topUpGoals(plan(), [soon], MON);

  assert.equal(added.length, 4, "the 5th through 8th inclusive");
  assert.ok(added.every((b) => b.date <= addDays(MON, 3)));
});

test("a day with no room is skipped rather than overbooked", () => {
  const busy = { fixed: [{ id: "f1", title: "Camp", days: [1], start: "00:00", end: "24:00" }], blocks: [] };

  const { added } = topUpGoals(busy, [goal()], MON);

  assert.ok(!added.some((b) => b.date === MON), "Monday is full");
  assert.ok(added.length > 0, "the other days still get sessions");
});

test("a goal whose deadline has gone is not topped up", () => {
  const over = goal({ deadline: `${addDays(MON, -1)}T23:00:00` });

  assert.deepEqual(topUpGoals(plan(), [over], MON).added, []);
});

test("a one-off thought with no daily commitment is never topped up", () => {
  const thought = { id: "t1", title: "Call mum", status: "active", deadline: `${far}T23:00:00` };

  assert.deepEqual(topUpGoals(plan(), [thought], MON).added, []);
});

test("finished and skipped goals are not topped up", () => {
  const items = [goal({ status: "done" }), goal({ id: "g2", status: "skipped" })];

  assert.deepEqual(topUpGoals(plan(), items, MON).added, []);
});

test("a session already ticked off does not count as runway", () => {
  const spent = Array.from({ length: 14 }, (_, i) => session(addDays(MON, i), { done: true }));

  const { added } = topUpGoals(plan(spent), [goal()], MON);

  assert.ok(added.length > 0, "the days are spent, so the goal needs fresh time");
});

test("two goals share the week without landing on top of each other", () => {
  const rust = goal();
  const essay = goal({ id: "g2", title: "Essay", minutesPerDay: 30 });

  const { state } = topUpGoals(plan(), [rust, essay], MON);

  for (const date of new Set(state.blocks.map((b) => b.date))) {
    const sameDay = state.blocks.filter((b) => b.date === date).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sameDay.length; i++) {
      const prevEnd = Number(sameDay[i - 1].start.slice(0, 2)) * 60 + Number(sameDay[i - 1].start.slice(3)) + sameDay[i - 1].minutes;
      const start = Number(sameDay[i].start.slice(0, 2)) * 60 + Number(sameDay[i].start.slice(3));
      assert.ok(start >= prevEnd, `${date}: ${sameDay[i - 1].start} and ${sameDay[i].start} overlap`);
    }
  }
});

test("the state handed in is not mutated", () => {
  const before = plan();

  topUpGoals(before, [goal()], MON);

  assert.deepEqual(before.blocks, []);
});
