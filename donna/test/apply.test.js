import test from "node:test";
import assert from "node:assert/strict";
import { applyProposals, APPLY_MINUTES } from "../src/lib/apply.js";
import { addDays } from "../src/lib/time.js";

const TODAY = "2099-01-05";
const find = (overrides = {}) => ({ id: "f1", title: "MIT PRIMES", url: "https://e/primes", deadline: addDays(TODAY, 10), note: "", foundOn: TODAY, ...overrides });
const plan = (blocks = [], findings = [], fixed = []) => ({ blocks, fixed, findings });

test("a deadline with no time against it gets a slot proposed", () => {
  const [first] = applyProposals({ plan: plan([], [find()]), date: TODAY, nowMinutes: 7 * 60 });

  assert.equal(first.finding.id, "f1");
  assert.equal(first.slot.minutes, APPLY_MINUTES);
  assert.ok(first.slot.date <= addDays(TODAY, 10), "before the thing closes");
});

test("she books it early rather than at the wire", () => {
  const [first] = applyProposals({ plan: plan([], [find()]), date: TODAY, nowMinutes: 7 * 60 });

  assert.equal(first.slot.date, TODAY, "the soonest slot, because people leave these too late");
});

test("a finding with no deadline is not something to block time for", () => {
  assert.deepEqual(applyProposals({ plan: plan([], [find({ deadline: null })]), date: TODAY, nowMinutes: 7 * 60 }), []);
});

test("one that has already closed is not offered", () => {
  assert.deepEqual(applyProposals({ plan: plan([], [find({ deadline: addDays(TODAY, -1) })]), date: TODAY, nowMinutes: 7 * 60 }), []);
});

test("once you've dealt with it she stops offering", () => {
  assert.deepEqual(applyProposals({ plan: plan([], [find({ handled: true })]), date: TODAY, nowMinutes: 7 * 60 }), []);
});

test("a week with no room before the deadline offers nothing rather than overbooking", () => {
  const packed = plan([], [find({ deadline: addDays(TODAY, 2) })], [{ id: "f", title: "Camp", days: [0,1,2,3,4,5,6], start: "00:00", end: "24:00" }]);

  assert.deepEqual(applyProposals({ plan: packed, date: TODAY, nowMinutes: 7 * 60 }), []);
});

test("the one closing soonest is offered first", () => {
  const findings = [find({ id: "far", title: "Later", deadline: addDays(TODAY, 20) }), find({ id: "soon", title: "Sooner", deadline: addDays(TODAY, 3) })];

  const out = applyProposals({ plan: plan([], findings), date: TODAY, nowMinutes: 7 * 60 });

  assert.equal(out[0].finding.id, "soon");
});

test("two proposals never land on the same slot", () => {
  const findings = [find({ id: "a", deadline: addDays(TODAY, 5) }), find({ id: "b", deadline: addDays(TODAY, 6) })];

  const out = applyProposals({ plan: plan([], findings), date: TODAY, nowMinutes: 7 * 60 });

  const slots = out.map((p) => `${p.slot.date} ${p.slot.start}`);
  assert.equal(new Set(slots).size, slots.length);
});

test("she offers a couple at a time, not every deadline she has ever found", () => {
  const findings = Array.from({ length: 9 }, (_, i) => find({ id: `f${i}`, url: `https://e/${i}`, deadline: addDays(TODAY, 5 + i) }));

  assert.ok(applyProposals({ plan: plan([], findings), date: TODAY, nowMinutes: 7 * 60 }).length <= 2);
});

test("the title says what the session is actually for", () => {
  const [first] = applyProposals({ plan: plan([], [find()]), date: TODAY, nowMinutes: 7 * 60 });

  assert.match(first.title, /apply/i);
  assert.match(first.title, /MIT PRIMES/);
});
