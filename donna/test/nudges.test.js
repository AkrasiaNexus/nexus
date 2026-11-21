import test from "node:test";
import assert from "node:assert/strict";
import { parseBlurt, getNudgeSchedule } from "../src/lib/parser.js";
import { dueNudges } from "../src/lib/nudges.js";

const NOW = Date.UTC(2026, 10, 10, 9, 0, 0);
const DAY = 86_400_000;

function item(text, overrides = {}) {
  const parsed = parseBlurt(text, NOW);
  return { id: text, status: "active", ...parsed, nudges: getNudgeSchedule(parsed.createdAt, parsed.deadline), ...overrides };
}

test("nothing is due before the first check-in", () => {
  assert.deepEqual(dueNudges([item("learn rust 8 days")], NOW, NOW + DAY), []);
});

test("a check-in that passed since the last look is due", () => {
  const due = dueNudges([item("learn rust 8 days")], NOW + DAY, NOW + 2 * DAY + 1);
  assert.equal(due.length, 1);
  assert.equal(due[0].nudge.pct, 25);
  assert.equal(due[0].item.title, "Learn rust");
});

test("after a long sleep only the latest check-in fires", () => {
  const due = dueNudges([item("learn rust 8 days")], NOW, NOW + 9 * DAY);
  assert.equal(due.length, 1);
  assert.equal(due[0].nudge.pct, 100);
  assert.equal(due[0].nudge.tone, "urgent");
});

test("finished and skipped items stay quiet", () => {
  const items = [item("a 8 days", { status: "done" }), item("b 8 days", { status: "skipped" })];
  assert.deepEqual(dueNudges(items, NOW, NOW + 9 * DAY), []);
});

test("each item is judged on its own schedule", () => {
  const due = dueNudges([item("learn rust 8 days"), item("call mom in 4 days")], NOW + 0.5 * DAY, NOW + 1.5 * DAY);
  assert.deepEqual(due.map((d) => [d.item.title, d.nudge.pct]), [["Call mom", 25]]);
});
