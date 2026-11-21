import test from "node:test";
import assert from "node:assert/strict";
import { queriesFor, normalise, unseen, dueSoonest } from "../src/lib/research.js";

const goal = (overrides = {}) => ({ id: "g1", title: "Learn Rust", status: "active", category: "skill", ...overrides });

test("she works out what to look for from what you're actually doing", () => {
  const queries = queriesFor([goal({ title: "Learn Rust", forProfile: true })], []);

  assert.ok(queries.length > 0);
  assert.ok(queries.some((q) => /rust/i.test(q)), "your own subject, not a generic list");
  assert.ok(queries.some((q) => /internship|hackathon|course|program/i.test(q)), "the kinds of thing that build a profile");
});

test("what she knows about you steers the search", () => {
  const queries = queriesFor([goal()], [{ id: "m1", text: "wants to study computer science in the US" }]);

  assert.ok(queries.some((q) => /computer science/i.test(q)), "a memory is context for the search too");
});

test("finished goals and one-off chores are not research topics", () => {
  const items = [goal({ status: "done" }), goal({ id: "g2", title: "Call mum", category: "task" })];

  assert.deepEqual(queriesFor(items, []), []);
});

test("she does not sit up all night: the search is bounded", () => {
  const many = Array.from({ length: 12 }, (_, i) => goal({ id: `g${i}`, title: `Subject ${i}`, forProfile: true }));

  assert.ok(queriesFor(many, []).length <= 6);
});

test("a result becomes a finding with the fields that matter", () => {
  const found = normalise({
    title: "MIT PRIMES 2026",
    url: "https://math.mit.edu/research/highschool/primes/",
    description: "Free year-long research program for high school students. Applications close December 1, 2026.",
  });

  assert.equal(found.title, "MIT PRIMES 2026");
  assert.equal(found.url, "https://math.mit.edu/research/highschool/primes/");
  assert.equal(found.deadline, "2026-12-01", "the deadline is a field, not a sentence to be misread later");
  assert.ok(found.id);
});

test("a result with no readable deadline keeps the finding and loses the date", () => {
  const found = normalise({ title: "Some hackathon", url: "https://example.com/h", description: "Rolling applications." });

  assert.equal(found.deadline, null);
  assert.equal(found.title, "Some hackathon");
});

test("junk without a title or a link is not a finding", () => {
  assert.equal(normalise({ title: "", url: "https://example.com" }), null);
  assert.equal(normalise({ title: "Something", url: "" }), null);
});

test("only things she hasn't already shown you count as new", () => {
  const seen = [{ id: "a", url: "https://example.com/a" }];
  const found = [{ id: "a", url: "https://example.com/a" }, { id: "b", url: "https://example.com/b" }];

  assert.deepEqual(unseen(found, seen).map((f) => f.id), ["b"]);
});

test("the same thing found under a different title is still the same thing", () => {
  const seen = [{ id: "a", url: "https://example.com/a" }];
  const found = [{ id: "zzz", url: "https://example.com/a", title: "Renamed" }];

  assert.deepEqual(unseen(found, seen), [], "matched on the link, not the wording");
});

test("the closest deadline leads, and the undated sit behind the dated", () => {
  const list = [
    { id: "none", deadline: null },
    { id: "far", deadline: "2099-06-01" },
    { id: "soon", deadline: "2099-01-10" },
  ];

  assert.deepEqual(dueSoonest(list).map((f) => f.id), ["soon", "far", "none"]);
});

test("something whose deadline has already gone is dropped, not shown", () => {
  const list = [{ id: "gone", deadline: "2000-01-01" }, { id: "live", deadline: "2099-01-10" }];

  assert.deepEqual(dueSoonest(list, "2099-01-01").map((f) => f.id), ["live"]);
});
