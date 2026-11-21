import test from "node:test";
import assert from "node:assert/strict";
import { unplanned } from "../src/lib/brief.js";

const item = (overrides = {}) => ({ id: "i1", title: "Learn Rust", status: "active", deadline: "2099-02-01T23:00:00", ...overrides });
const block = (overrides = {}) => ({ id: "b1", itemId: "i1", title: "Rust", date: "2099-01-20", start: "19:00", minutes: 60, done: false, ...overrides });

test("something you dumped with no time booked is unplanned", () => {
  assert.deepEqual(unplanned([item()], []).map((i) => i.id), ["i1"]);
});

test("something with time booked ahead is not", () => {
  assert.deepEqual(unplanned([item()], [block()]), []);
});

test("a goal whose sessions are all ticked off needs attention again", () => {
  const done = unplanned([item()], [block({ done: true })]);

  assert.deepEqual(done.map((i) => i.id), ["i1"], "nothing is booked ahead, so it is either finished or needs more time");
});

test("finished and skipped things never appear", () => {
  assert.deepEqual(unplanned([item({ status: "done" }), item({ id: "i2", status: "skipped" })], []), []);
});

test("blocks belonging to another goal do not count as cover", () => {
  assert.deepEqual(unplanned([item()], [block({ itemId: "other" })]).map((i) => i.id), ["i1"]);
});

test("a one-off session with no goal behind it covers nothing", () => {
  assert.deepEqual(unplanned([item()], [block({ itemId: null })]).map((i) => i.id), ["i1"]);
});

test("the soonest deadline leads, because that is the one about to bite", () => {
  const soon = item({ id: "soon", deadline: "2099-01-10T23:00:00" });
  const later = item({ id: "later", deadline: "2099-03-01T23:00:00" });

  assert.deepEqual(unplanned([later, soon], []).map((i) => i.id), ["soon", "later"]);
});

test("an item with a corrupt deadline is still shown rather than silently dropped", () => {
  const broken = item({ id: "broken", deadline: undefined });

  assert.deepEqual(unplanned([broken], []).map((i) => i.id), ["broken"]);
});
