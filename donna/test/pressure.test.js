import test from "node:test";
import assert from "node:assert/strict";
import { displacementCost } from "../src/lib/pressure.js";

const MON = "2099-01-05";
const day = (i) => `2099-01-${String(5 + i).padStart(2, "0")}`;

const goal = (overrides = {}) => ({
  id: "g1", title: "Learn Rust", status: "active",
  deadline: `${day(4)}T23:00:00`, minutesPerDay: 60, ...overrides,
});

const session = (i, overrides = {}) => ({
  id: `b${i}`, itemId: "g1", title: "Rust", date: day(i), start: "19:00", minutes: 60, done: false, ...overrides,
});

const plan = (blocks) => ({ fixed: [], blocks });
const proposed = { date: day(1), start: "19:00", minutes: 60 };

test("a booking in free time displaces nothing", () => {
  const cost = displacementCost(plan([session(1)]), [goal()], { date: day(1), start: "15:00", minutes: 60 }, MON);

  assert.equal(cost, null);
});

test("a booking over a session names what it would displace", () => {
  const cost = displacementCost(plan([session(1)]), [goal()], proposed, MON);

  assert.equal(cost.block.id, "b1");
  assert.equal(cost.goal.title, "Learn Rust");
});

test("a goal with room to spare says so, so a one-off swap is not a crisis", () => {
  const blocks = [session(1), session(2), session(3), session(4)];
  const relaxed = goal({ deadline: `${day(6)}T23:00:00` });

  const cost = displacementCost(plan(blocks), [relaxed], proposed, MON);

  assert.equal(cost.sessionsLeft, 4);
  assert.ok(cost.daysLeft > cost.sessionsLeft - 1, "there are spare days to make it up");
  assert.equal(cost.tight, false);
});

test("a goal that needs every remaining day is tight, and says so", () => {
  const blocks = [session(1), session(2), session(3), session(4)];

  const cost = displacementCost(plan(blocks), [goal()], proposed, MON);

  assert.equal(cost.sessionsLeft, 4);
  assert.equal(cost.daysLeft, 4);
  assert.equal(cost.tight, true, "four sessions and four days leaves nowhere to move one to");
});

test("sessions already ticked off do not count towards what is left", () => {
  const blocks = [session(1), session(2, { done: true }), session(3), session(4)];

  const cost = displacementCost(plan(blocks), [goal()], proposed, MON);

  assert.equal(cost.sessionsLeft, 3);
});

test("displacing a one-off with no goal behind it still reports the clash", () => {
  const loose = { id: "b9", itemId: null, title: "Haircut", date: day(1), start: "19:00", minutes: 60, done: false };

  const cost = displacementCost(plan([loose]), [], proposed, MON);

  assert.equal(cost.block.title, "Haircut");
  assert.equal(cost.goal, null);
  assert.equal(cost.tight, false);
});

test("the warning names the thing, what is left, and the time it has to fit in", () => {
  const blocks = [session(1), session(2), session(3), session(4)];

  const { warning } = displacementCost(plan(blocks), [goal()], proposed, MON);

  assert.match(warning, /learn rust/i, "Donna speaks lowercase");
  assert.match(warning, /4/);
  assert.doesNotMatch(warning, /undefined|NaN/);
});
