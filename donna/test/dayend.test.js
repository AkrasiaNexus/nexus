import test from "node:test";
import assert from "node:assert/strict";
import { unfinishedToday, shouldAskAboutToday, EVENING_FROM } from "../src/lib/dayend.js";
import { toMin } from "../src/lib/time.js";

const DATE = "2099-01-05";
const YESTERDAY = "2099-01-04";
const block = (overrides = {}) => ({ id: "b1", itemId: "g1", title: "Rust", date: DATE, start: "19:00", minutes: 60, done: false, ...overrides });
const plan = (blocks, askedOn = null) => ({ fixed: [], blocks, askedOn });

const LATE = toMin("21:30");

test("a session that has ended and was never ticked off is unfinished", () => {
  assert.deepEqual(unfinishedToday(plan([block()]), DATE, LATE).map((b) => b.id), ["b1"]);
});

test("a session still running is not asked about yet", () => {
  assert.deepEqual(unfinishedToday(plan([block({ start: "21:00" })]), DATE, LATE), []);
});

test("a session already ticked off is not asked about", () => {
  assert.deepEqual(unfinishedToday(plan([block({ done: true })]), DATE, LATE), []);
});

test("another day's sessions are not today's business", () => {
  assert.deepEqual(unfinishedToday(plan([block({ date: YESTERDAY })]), DATE, LATE), []);
});

test("they come back in the order the day ran", () => {
  const blocks = [block({ id: "late", start: "20:00" }), block({ id: "early", start: "15:00" })];

  assert.deepEqual(unfinishedToday(plan(blocks), DATE, LATE).map((b) => b.id), ["early", "late"]);
});

test("nothing is asked before the evening, however much is unfinished", () => {
  assert.equal(shouldAskAboutToday(plan([block({ start: "09:00" })]), DATE, toMin("14:00")), false);
});

test("in the evening, with something unfinished, she asks", () => {
  assert.equal(shouldAskAboutToday(plan([block()]), DATE, LATE), true);
});

test("a clear day is left alone", () => {
  assert.equal(shouldAskAboutToday(plan([block({ done: true })]), DATE, LATE), false);
});

test("she asks once a day, not every tick after nine", () => {
  assert.equal(shouldAskAboutToday(plan([block()], DATE), DATE, LATE), false, "already asked today");
  assert.equal(shouldAskAboutToday(plan([block()], YESTERDAY), DATE, LATE), true, "yesterday's ask does not count");
});

test("the evening starts at a sensible hour, not at midnight", () => {
  assert.ok(EVENING_FROM >= toMin("20:00") && EVENING_FROM <= toMin("22:00"));
});
