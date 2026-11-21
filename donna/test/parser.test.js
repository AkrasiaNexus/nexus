import test from "node:test";
import assert from "node:assert/strict";
import { parseBlurt, getNudgeSchedule } from "../src/lib/parser.js";

const NOW = new Date(2026, 10, 10, 9, 0, 0).getTime(); // Tuesday 10 November 2026, local
const DAY = 86_400_000;
const parse = (text) => parseBlurt(text, NOW);
const days = (item) => Math.round(item.timeframeMs / DAY);

test("reads a plain timeframe and turns the rest into a title", () => {
  const item = parse("learn rust 2 weeks");
  assert.equal(item.category, "skill");
  assert.equal(days(item), 14);
  assert.equal(item.title, "Learn rust");
  assert.equal(item.deadline, new Date(NOW + 14 * DAY).toISOString());
});

test("drops filler like 'i wanna' and a dangling 'in'", () => {
  assert.equal(parse("i wanna learn rust in 2 weeks").title, "Learn rust");
  assert.equal(parse("gotta finish the essay by tomorrow").title, "Finish the essay");
});

test("numbers that are not timeframes stay in the title", () => {
  const eggs = parse("buy 3 more eggs tomorrow");
  assert.equal(days(eggs), 1);
  assert.equal(eggs.title, "Buy 3 more eggs");

  const drones = parse("build 2 drones this month");
  assert.equal(drones.title, "Build 2 drones");
  assert.equal(days(drones), 30);
});

test("understands minutes, hours, days, months and short forms", () => {
  assert.equal(parse("call mom in 30 mins").timeframeMs, 30 * 60_000);
  assert.equal(parse("stretch 2h").timeframeMs, 2 * 3_600_000);
  assert.equal(days(parse("read the paper 3 days")), 3);
  assert.equal(days(parse("get into piano 3 months")), 92);
  assert.equal(days(parse("ship it next week")), 7);
});

test("defaults to one week when no timeframe is given", () => {
  assert.equal(days(parse("look into that receipts startup idea")), 7);
});

test("category comes from the first keyword, matched as a whole word", () => {
  assert.equal(parse("look into that receipts startup idea").category, "explore");
  assert.equal(parse("walk the dog").category, "habit");
  assert.equal(parse("happy birthday card for sam").category, "task");
  assert.equal(parse("gym 3x this week").category, "habit");
  assert.equal(parse("build a tray app").category, "idea");
});

test("effort follows the timeframe", () => {
  assert.equal(parse("call mom in 30 mins").effort, "quick");
  assert.equal(parse("read the paper 3 days").effort, "short");
  assert.equal(parse("learn rust 2 weeks").effort, "medium");
  assert.equal(parse("get into piano 3 months").effort, "long");
});

test("nudge schedule checks in at 25, 50, 75 and 100 percent", () => {
  const start = new Date(NOW).toISOString();
  const end = new Date(NOW + 8 * DAY).toISOString();
  const schedule = getNudgeSchedule(start, end);
  assert.deepEqual(schedule.map((n) => n.pct), [25, 50, 75, 100]);
  assert.deepEqual(schedule.map((n) => n.at), [2, 4, 6, 8].map((d) => new Date(NOW + d * DAY).toISOString()));
  assert.deepEqual(schedule.map((n) => n.tone), ["gentle", "firm", "firm", "urgent"]);
});

test("reads a weekday, an absolute date and a time of day", () => {
  // Bare "friday" is the one coming up; "next friday" is next week's. NOW is a Tuesday.
  assert.equal(new Date(parse("essay due friday").deadline).getDate(), 13);
  const friday = new Date(parse("essay due next friday").deadline);
  assert.equal(friday.getDay(), 5);
  assert.equal(friday.getDate(), 20);

  const ucas = new Date(parse("submit UCAS by jan 15").deadline);
  assert.equal(ucas.getFullYear(), 2027);
  assert.equal(ucas.getMonth(), 0);
  assert.equal(ucas.getDate(), 15);

  const gym = new Date(parse("gym tomorrow at 6am").deadline);
  assert.equal(gym.getDate(), 11);
  assert.equal(gym.getHours(), 6);
});

test("the date it read is taken out of the title", () => {
  assert.equal(parse("essay due next friday").title, "Essay due");
  assert.equal(parse("interview next tuesday 2pm").title, "Interview");
  assert.equal(parse("submit UCAS by jan 15").title, "Submit UCAS");
});

test("abbreviated units still read", () => {
  assert.equal(days(parse("learn rust 2 wks")), 14);
  assert.equal(days(parse("do it in 3 mo")), 92);
  assert.equal(parse("stretch 30 min").timeframeMs, 30 * 60_000);
});

test("'this week' and 'this month' mean by the end of one, not the start", () => {
  assert.equal(days(parse("gym 3x this week")), 7);
  assert.equal(days(parse("build 2 drones this month")), 30);
});

test("a date already gone is not a deadline", () => {
  assert.equal(days(parse("essay due yesterday")), 7);
});

test("'today' is due by the end of today, not seven days out", () => {
  assert.equal(parse("gym today").timeframeMs, 12 * 3_600_000);
  assert.equal(parse("gym today").title, "Gym");
});

test("a bare month name in prose is not a deadline", () => {
  const march = parse("march madness bracket");
  assert.equal(days(march), 7, "no date was given, so the default stands");
  assert.equal(march.title, "March madness bracket", "and the word stays in the title");
  assert.equal(parse("august plans").title, "August plans");
  // A written-out duration keeps working: it is a number of months, not a month.
  assert.equal(days(parse("get into piano 3 months")), 92);
});

test("a timeframe under a minute is not a deadline", () => {
  assert.equal(days(parse("see you in a sec")), 7);
});

test("a three-letter weekday inside a phrase is prose, not a deadline", () => {
  assert.equal(days(parse("sat nav fix")), 7);
  assert.equal(parse("sat nav fix").title, "Sat nav fix");
  assert.equal(parse("sun screen").title, "Sun screen");
  assert.equal(parse("wed photos").title, "Wed photos");
  // Spelled out it is a real deadline. NOW is Tuesday 10 November 2026.
  assert.equal(new Date(parse("essay due saturday").deadline).getDay(), 6);
});

test("a blurt that is only a date keeps the words that were typed", () => {
  assert.equal(parse("friday").title, "Friday");
  assert.equal(parse("3 months").title, "3 months");
});

test("a preposition the date left behind is cleaned up", () => {
  assert.equal(parse("essay due by friday at the latest").title, "Essay due at the latest");
});
