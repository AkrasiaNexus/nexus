import test from "node:test";
import assert from "node:assert/strict";
import { parseReminder, dueRemindersAt, outstanding, whenSaid, completeReminder, msUntilNext } from "../src/lib/remind.js";

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

test("a reminder stays outstanding after it has fired, until it is ticked off", () => {
  const fired = { id: "r1", text: "Bins", at: NOW - 60_000, done: false };
  const later = { id: "r2", text: "Headphones", at: NOW + 3_600_000, done: false };
  const ticked = { id: "r3", text: "Washing", at: NOW - 60_000, done: true };

  assert.deepEqual(outstanding([fired, later, ticked], NOW).map((r) => r.id), ["r1"]);
});

test("outstanding reminders come oldest first, because that's the one you forgot longest ago", () => {
  const old = { id: "old", text: "Bins", at: NOW - 7_200_000, done: false };
  const recent = { id: "recent", text: "Washing", at: NOW - 60_000, done: false };

  assert.deepEqual(outstanding([recent, old], NOW).map((r) => r.id), ["old", "recent"]);
});

test("a reminder with no time set is never outstanding, it is just waiting", () => {
  assert.deepEqual(outstanding([{ id: "r1", text: "Someday", at: null, done: false }], NOW), []);
});

// NOW is Thursday 2099-01-08, 14:00. Each case below was wrong before chrono read the time:
// three of them fired on the wrong day, and the rest had no time and quietly never fired.
const on = (text) => {
  const reminder = at(text);
  const when = reminder?.at && new Date(reminder.at);
  return reminder && { text: reminder.text, day: when?.getDate(), hour: when?.getHours(), minute: when?.getMinutes() };
};

test("a day named with the time is that day, not today", () => {
  assert.deepEqual(on("remind me to call mum tomorrow at 9am"), { text: "Call mum", day: 9, hour: 9, minute: 0 });
  assert.deepEqual(on("remind me to call mum tmrw at 9am"), { text: "Call mum", day: 9, hour: 9, minute: 0 });
  assert.deepEqual(on("remind me to call mum on friday at 3pm"), { text: "Call mum", day: 9, hour: 15, minute: 0 });
});

test("the time can come before the thing", () => {
  assert.deepEqual(on("remind me in 20 mins to call mum"), { text: "Call mum", day: 8, hour: 14, minute: 20 });
  assert.deepEqual(on("remind me tmrw to call mum"), { text: "Call mum", day: 9, hour: 9, minute: 0 });
});

test("spelled-out and fractional durations count", () => {
  assert.equal(at("remind me to call mum in an hour").at, NOW + 60 * 60_000);
  assert.equal(at("remind me to call mum in 1.5 hours").at, NOW + 90 * 60_000);
  assert.equal(at("remind me to stretch in half an hour").at, NOW + 30 * 60_000);
});

test("a bare hour means the next time the clock shows it, not that hour tomorrow morning", () => {
  // Said at 2pm, "at 5" is 5pm. Read literally it was 05:00 the next day — twelve hours late.
  assert.deepEqual(on("remind me to call mum at 5"), { text: "Call mum", day: 8, hour: 17, minute: 0 });
  assert.deepEqual(on("remind me to call mum at 5:30"), { text: "Call mum", day: 8, hour: 17, minute: 30 });
  assert.deepEqual(on("remind me to call mum at 11"), { text: "Call mum", day: 8, hour: 23, minute: 0 });
  // A 24-hour time is never ambiguous.
  assert.deepEqual(on("remind me to call mum at 17:30"), { text: "Call mum", day: 8, hour: 17, minute: 30 });
});

test("a day with no time lands at the start of that day", () => {
  assert.deepEqual(on("remind me friday to call mum"), { text: "Call mum", day: 9, hour: 9, minute: 0 });
});

test("a part of the day is taken at its word", () => {
  assert.deepEqual(on("remind me to call mum tonight"), { text: "Call mum", day: 8, hour: 22, minute: 0 });
  assert.equal(on("remind me to call mum at noon").hour, 12);
});

test("a word that only looks like a date stays in the reminder", () => {
  assert.deepEqual(on("remind me to fix the sat nav at 6pm"), { text: "Fix the sat nav", day: 8, hour: 18, minute: 0 });
  assert.equal(at("remind me to book march tickets").text, "Book march tickets");
  assert.equal(at("remind me to book march tickets").at, null);
});

test("she says the time back on the real clock, so a wrong guess is seen at once", () => {
  assert.equal(whenSaid(NOW + 20 * 60_000, NOW), "in 20 mins");
  assert.equal(whenSaid(NOW + 1 * 60_000, NOW), "in 1 min");
  assert.equal(whenSaid(new Date(2099, 0, 8, 23, 0).getTime(), NOW), "at 23:00");
  assert.equal(whenSaid(new Date(2099, 0, 9, 9, 0).getTime(), NOW), "fri 09:00");
});

test("a deadline-style time leaves no dangling word, and a phrasal verb keeps its ending", () => {
  assert.equal(at("remind me to submit the essay by 5pm").text, "Submit the essay");
  assert.equal(at("remind me to put the washing on in 20 mins").text, "Put the washing on");
  assert.equal(at("remind me to drop by in 20 mins").text, "Drop by");
});

test("a reminder with no time is finished by a reply that is only a time", () => {
  const done = completeReminder("Call mum", "5pm", NOW);
  assert.equal(done.text, "Call mum");
  assert.equal(new Date(done.at).getHours(), 17);

  assert.equal(new Date(completeReminder("Call mum", "at 5", NOW).at).getHours(), 17, "the bare-hour rule still applies");
  assert.equal(new Date(completeReminder("Call mum", "tmrw", NOW).at).getDate(), 9);
  assert.equal(completeReminder("Call mum", "in 20 mins", NOW).at, NOW + 20 * 60_000);
});

test("a reply that is more than a time is a new message, and the reminder is let go", () => {
  assert.equal(completeReminder("Call mum", "nvm book gym at 6", NOW), null);
  assert.equal(completeReminder("Call mum", "whats my day looking like", NOW), null);
  assert.equal(completeReminder("Call mum", "idk", NOW), null);
});

test("ping me and nudge me are asking too", () => {
  assert.equal(at("ping me in 10 mins to check the oven").text, "Check the oven");
  assert.equal(at("nudge me at 6pm to stretch").text, "Stretch");
});

test("the wait until the next reminder ignores done, unscheduled and already-due ones", () => {
  const reminders = [
    { id: "r1", text: "Done", at: NOW + 10_000, done: true },
    { id: "r2", text: "Someday", at: null, done: false },
    { id: "r3", text: "Past", at: NOW - 10_000, done: false },
    { id: "r4", text: "Later", at: NOW + 90_000, done: false },
    { id: "r5", text: "Soon", at: NOW + 30_000, done: false },
  ];
  assert.equal(msUntilNext(reminders, NOW), 30_000);
  assert.equal(msUntilNext([], NOW), null);
});

test("a bare hour with a day named lands in the waking day, not the small hours", () => {
  // NOW is Thursday 14:00. Read literally, every one of these fired between 03:00 and 05:00.
  assert.deepEqual(on("remind me tomorrow at 5 to call mum"), { text: "Call mum", day: 9, hour: 17, minute: 0 });
  assert.deepEqual(on("remind me to call mum friday at 3"), { text: "Call mum", day: 9, hour: 15, minute: 0 });
  assert.deepEqual(on("remind me to call mum at 5 tomorrow"), { text: "Call mum", day: 9, hour: 17, minute: 0 });
  // Morning hours stay in the morning.
  assert.deepEqual(on("remind me to call mum tmrw at 9"), { text: "Call mum", day: 9, hour: 9, minute: 0 });
  // An explicit am is believed.
  assert.deepEqual(on("remind me to call mum tomorrow at 5am"), { text: "Call mum", day: 9, hour: 5, minute: 0 });
});

test("the most natural answers to when? finish the reminder", () => {
  assert.equal(new Date(completeReminder("Call mum", "5", NOW).at).getHours(), 17);
  assert.equal(new Date(completeReminder("Call mum", "5:30", NOW).at).getMinutes(), 30);
  assert.equal(completeReminder("Call mum", "in 5", NOW).at, NOW + 5 * 60_000);
});

test("a time read without its preposition leaves no dangling word", () => {
  assert.equal(at("remind me to call mum at noon").text, "Call mum");
});
