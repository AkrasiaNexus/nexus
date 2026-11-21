import test from "node:test";
import assert from "node:assert/strict";
import { observations } from "../src/lib/patterns.js";
import { addDays } from "../src/lib/time.js";

// A Monday, so weekday arithmetic in the tests is readable.
const TODAY = "2099-01-12";
const back = (n) => addDays(TODAY, -n);

const goal = (overrides = {}) => ({
  id: "g1", title: "Learn Rust", status: "active", createdAt: `${back(20)}T09:00:00`,
  deadline: `${addDays(TODAY, 20)}T23:00:00`, minutesPerDay: 60, priority: "medium", ...overrides,
});
const sess = (date, done, overrides = {}) => ({ id: `b-${date}-${overrides.itemId ?? "g1"}`, itemId: "g1", title: "Rust", date, start: "19:00", minutes: 60, done, ...overrides });
const of = (kind, out) => out.find((o) => o.kind === kind);

test("one missed session is not a pattern", () => {
  const out = observations({ items: [goal()], plan: { blocks: [sess(back(1), false)], fixed: [] }, date: TODAY });

  assert.equal(of("skipped", out), undefined);
});

test("skipping the same thing over and over is", () => {
  const blocks = [sess(back(1), false), sess(back(2), false), sess(back(3), false)];

  const out = observations({ items: [goal()], plan: { blocks, fixed: [] }, date: TODAY });

  assert.match(of("skipped", out).text, /3/);
  assert.match(of("skipped", out).text, /rust/i);
});

test("sessions you actually did are not skips", () => {
  const blocks = [sess(back(1), true), sess(back(2), true), sess(back(3), false)];

  assert.equal(of("skipped", observations({ items: [goal()], plan: { blocks, fixed: [] }, date: TODAY })), undefined);
});

test("a day of the week you never deliver on is called out by name", () => {
  // the three previous Fridays, all booked, none done
  const fridays = [sess(back(4), false), sess(back(11), false), sess(back(18), false)];

  const out = observations({ items: [goal()], plan: { blocks: fridays, fixed: [] }, date: TODAY });

  assert.match(of("deadDay", out).text, /thu/i, "names the weekday those sessions fell on");
});

test("a weekday you sometimes deliver on is not a dead day", () => {
  const mixed = [sess(back(4), false), sess(back(11), true), sess(back(18), false)];

  assert.equal(of("deadDay", observations({ items: [goal()], plan: { blocks: mixed, fixed: [] }, date: TODAY })), undefined);
});

test("something on the list for a fortnight and never once touched", () => {
  const out = observations({ items: [goal()], plan: { blocks: [], fixed: [] }, date: TODAY });

  assert.match(of("neverStarted", out).text, /20 days|rust/i);
});

test("a goal added yesterday is not nagged about", () => {
  const fresh = goal({ createdAt: `${back(1)}T09:00:00` });

  assert.equal(of("neverStarted", observations({ items: [fresh], plan: { blocks: [], fixed: [] }, date: TODAY })), undefined);
});

test("she notices a run of doing the work, not only the failures", () => {
  const streak = [sess(back(1), true), sess(back(2), true), sess(back(3), true), sess(back(4), true)];

  const out = observations({ items: [goal()], plan: { blocks: streak, fixed: [] }, date: TODAY });

  assert.match(of("streak", out).text, /4/);
});

test("future sessions are not evidence of anything yet", () => {
  const ahead = [sess(addDays(TODAY, 1), false), sess(addDays(TODAY, 2), false), sess(addDays(TODAY, 3), false)];

  assert.deepEqual(observations({ items: [goal()], plan: { blocks: ahead, fixed: [] }, date: TODAY }), []);
});

test("she says at most a couple of things, and never shouts", () => {
  const blocks = [sess(back(1), false), sess(back(2), false), sess(back(3), false), sess(back(4), false), sess(back(11), false), sess(back(18), false)];

  const out = observations({ items: [goal()], plan: { blocks, fixed: [] }, date: TODAY });

  assert.ok(out.length <= 2);
  for (const o of out) assert.doesNotMatch(o.text, /!|[A-Z]{3,}/);
});

test("a finished goal is not picked over", () => {
  const blocks = [sess(back(1), false), sess(back(2), false), sess(back(3), false)];

  assert.deepEqual(observations({ items: [goal({ status: "done" })], plan: { blocks, fixed: [] }, date: TODAY }), []);
});
