import test from "node:test";
import assert from "node:assert/strict";
import { parseBlurt, getNudgeSchedule } from "../src/lib/parser.js";

const NOW = Date.UTC(2026, 10, 10, 9, 0, 0);
const DAY = 86_400_000;
const parse = (text) => parseBlurt(text, NOW);
const days = (item) => item.timeframeMs / DAY;

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
  assert.equal(days(parse("get into piano 3 months")), 90);
  assert.equal(days(parse("ship it next week")), 14);
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
