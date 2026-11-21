import test from "node:test";
import assert from "node:assert/strict";
import { shouldResearch, RESEARCH_FROM } from "../src/lib/nightly.js";
import { toMin } from "../src/lib/time.js";

const TODAY = "2099-01-05";
const YESTERDAY = "2099-01-04";
const plan = (researchedOn = null) => ({ researchedOn });

test("she doesn't go looking in the middle of your day", () => {
  assert.equal(shouldResearch(plan(), TODAY, toMin("14:00")), false);
});

test("late enough, and she hasn't looked today, she goes", () => {
  assert.equal(shouldResearch(plan(), TODAY, RESEARCH_FROM), true);
});

test("once a night, not every tick after midnight", () => {
  assert.equal(shouldResearch(plan(TODAY), TODAY, RESEARCH_FROM), false);
});

test("a Mac asleep through the small hours catches up when it wakes", () => {
  // morning, nothing ran last night: she goes as soon as she can rather than skipping a day
  assert.equal(shouldResearch(plan(YESTERDAY), TODAY, toMin("08:00")), true);
});

test("having run this morning, she doesn't run again tonight", () => {
  assert.equal(shouldResearch(plan(TODAY), TODAY, toMin("23:30")), false);
});

test("the hour is late evening, not the middle of the night when the machine is asleep", () => {
  assert.ok(RESEARCH_FROM >= toMin("21:00"), "late enough to be done for the day");
  assert.ok(RESEARCH_FROM <= toMin("23:59"), "not so late the Mac is certainly asleep");
});

import { researchOnce } from "../src/lib/nightly.js";
import { SearchUnavailable } from "../src/lib/search.js";

const goal = (overrides = {}) => ({ id: "g1", title: "Learn Rust", status: "active", category: "skill", ...overrides });
const hit = (n) => ({ url: `https://e/${n}`, title: `Thing ${n}`, description: "closes January 10, 2099" });

test("a night's work turns searches into findings", async () => {
  const { found } = await researchOnce({ items: [goal()], memories: [], findings: [], search: async () => [hit(1)] });

  assert.equal(found.length, 1);
  assert.equal(found[0].deadline, "2099-01-10");
});

test("the same thing found on two different queries is counted once", async () => {
  const { found } = await researchOnce({ items: [goal()], memories: [], findings: [], search: async () => [hit(1), hit(1)] });

  assert.equal(found.length, 1);
});

test("something she showed you last week is not news again", async () => {
  const already = [{ id: "e/1", url: "https://e/1" }];

  const { found } = await researchOnce({ items: [goal()], memories: [], findings: already, search: async () => [hit(1)] });

  assert.deepEqual(found, []);
});

test("nothing worth researching is a reason, not a crash", async () => {
  const { found, reason } = await researchOnce({ items: [], memories: [], findings: [], search: async () => [hit(1)] });

  assert.deepEqual(found, []);
  assert.match(reason, /nothing on your list/i);
});

test("a search that cannot run is a quiet night, not a broken app", async () => {
  const { found, reason } = await researchOnce({
    items: [goal()], memories: [], findings: [],
    search: async () => { throw new SearchUnavailable("the search key was refused"); },
  });

  assert.deepEqual(found, []);
  assert.match(reason, /refused/);
});
