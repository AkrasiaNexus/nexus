import test from "node:test";
import assert from "node:assert/strict";
import { pendingDeadlines, requiresConfirmation, objection } from "../src/lib/pushback.js";

const TODAY = "2026-11-24";

const item = (overrides = {}) => ({
  id: "i1", title: "Physics pset", status: "active",
  deadline: `${TODAY}T18:00:00`, ...overrides,
});

test("an unfinished thing due today counts as pending", () => {
  assert.deepEqual(pendingDeadlines([item()], TODAY).map((i) => i.id), ["i1"]);
});

test("something finished never blocks anything", () => {
  assert.deepEqual(pendingDeadlines([item({ status: "done" })], TODAY), []);
});

test("something skipped never blocks anything", () => {
  assert.deepEqual(pendingDeadlines([item({ status: "skipped" })], TODAY), []);
});

test("a deadline later in the week is not pending yet", () => {
  assert.deepEqual(pendingDeadlines([item({ deadline: "2026-11-28T18:00:00" })], TODAY), []);
});

test("a deadline late on the day itself still counts", () => {
  const lateTonight = item({ deadline: `${TODAY}T23:30:00` });

  assert.deepEqual(pendingDeadlines([lateTonight], TODAY).map((i) => i.id), ["i1"]);
});

test("the soonest deadline is the one that leads", () => {
  const later = item({ id: "late", deadline: `${TODAY}T20:00:00` });
  const sooner = item({ id: "soon", deadline: "2026-11-22T09:00:00" });

  assert.deepEqual(pendingDeadlines([later, sooner], TODAY).map((i) => i.id), ["soon", "late"]);
});

test("a clear day needs no confirmation", () => {
  assert.equal(requiresConfirmation([item({ status: "done" })], TODAY), false);
  assert.equal(objection([item({ status: "done" })], TODAY), null);
});

test("a day with something due asks before booking over it", () => {
  assert.equal(requiresConfirmation([item()], TODAY), true);
  assert.match(objection([item()], TODAY), /Physics pset/);
  assert.match(objection([item()], TODAY), /still want this booked\?/);
});

test("the objection counts the others rather than listing them all", () => {
  const items = [item(), item({ id: "i2", title: "Essay" }), item({ id: "i3", title: "Lab report" })];

  assert.match(objection(items, TODAY), /\(and 2 more\)/);
});
