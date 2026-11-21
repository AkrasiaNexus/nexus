import test from "node:test";
import assert from "node:assert/strict";
import { parseReminder, dueRemindersAt } from "../src/lib/remind.js";

// Thu 2099-01-08, 14:00 local.
const NOW = new Date(2099, 0, 8, 14, 0).getTime();
const at = (text) => parseReminder(text, NOW);

test("remind me to X in N minutes fires N minutes from now", () => {
  const reminder = at("remind me to put the washing on in 20 mins");

  assert.equal(reminder.text, "Put the washing on");
  assert.equal(reminder.at, NOW + 20 * 60_000);
});

test("hours work the same way", () => {
  assert.equal(at("remind me to call the dentist in 2 hours").at, NOW + 120 * 60_000);
});

test("a clock time today is used as given", () => {
  const reminder = at("remind me to take the bins out at 6pm");

  assert.equal(new Date(reminder.at).getHours(), 18);
  assert.equal(new Date(reminder.at).getDate(), 8);
});

test("a clock time that has gone rolls to tomorrow", () => {
  const reminder = at("remind me to email sir at 9am");

  assert.equal(new Date(reminder.at).getDate(), 9);
});

test("something with no time is still a reminder, it just has no when", () => {
  const reminder = at("remind me to charge my headphones");

  assert.equal(reminder.text, "Charge my headphones");
  assert.equal(reminder.at, null, "an unscheduled reminder waits to be given a time");
});

test("anything that isn't asking to be reminded is left alone", () => {
  assert.equal(at("gym at 6pm"), null);
  assert.equal(at("i wanna learn rust"), null);
  assert.equal(at("whats my day looking like"), null);
});

test("the other ways of asking all count", () => {
  for (const phrasing of [
    "remind me to lock the back door in 10 mins",
    "dont let me forget to lock the back door in 10 mins",
    "remember to lock the back door in 10 mins",
  ]) {
    assert.equal(at(phrasing)?.text, "Lock the back door", phrasing);
  }
});

test("a reminder whose moment has arrived is due, once", () => {
  const reminder = { id: "r1", text: "Bins", at: NOW, done: false };

  assert.deepEqual(dueRemindersAt([reminder], NOW - 60_000, NOW).map((r) => r.id), ["r1"]);
  assert.deepEqual(dueRemindersAt([reminder], NOW, NOW + 60_000), [], "not again on the next tick");
});

test("one slept through still fires, because a forgotten two-minute job is the whole point", () => {
  const reminder = { id: "r1", text: "Bins", at: NOW, done: false };

  assert.deepEqual(dueRemindersAt([reminder], NOW - 6 * 3_600_000, NOW).map((r) => r.id), ["r1"]);
});

test("done and unscheduled reminders stay quiet", () => {
  const done = { id: "r1", text: "Bins", at: NOW, done: true };
  const someday = { id: "r2", text: "Headphones", at: null, done: false };

  assert.deepEqual(dueRemindersAt([done, someday], NOW - 60_000, NOW), []);
});
