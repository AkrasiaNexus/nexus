import test from "node:test";
import assert from "node:assert/strict";
import { getNudgeMessage, getReminderMessage } from "../src/lib/nudgeMessages.js";

test("a deadline nudge always names the thing and leaves no placeholder behind", () => {
  for (const tone of ["gentle", "firm", "urgent"]) {
    const msg = getNudgeMessage(tone, "Learn Rust");

    assert.match(msg, /Learn Rust/);
    assert.doesNotMatch(msg, /\{title\}|\{mins\}/);
  }
});

test("an unknown tone falls back to the gentle pool rather than throwing", () => {
  assert.match(getNudgeMessage("nonsense", "Learn Rust"), /Learn Rust/);
});

test("a reminder before the session counts down to it", () => {
  const msg = getReminderMessage("Rust", 5);

  assert.match(msg, /Rust/);
  assert.match(msg, /5 mins/);
  assert.doesNotMatch(msg, /ago|late|without u/);
});

test("a reminder after the session has started says so instead of counting down", () => {
  const msg = getReminderMessage("Rust", -10);

  assert.match(msg, /10 mins/);
  assert.match(msg, /ago|late|without u/);
});

test("one minute is not pluralised", () => {
  assert.match(getReminderMessage("Rust", 1), /\b1 min\b/);
});
