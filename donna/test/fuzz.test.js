// Property tests: thousands of seeded random inputs per function, checked against what must
// always hold rather than against hand-picked answers. Seeded, so a failure reproduces exactly:
// the message names the seed and the input.
process.env.TZ = "Asia/Dubai";

import test from "node:test";
import assert from "node:assert/strict";
import { parseBlurt } from "../src/lib/parser.js";
import { parseReminder, completeReminder, whenSaid } from "../src/lib/remind.js";
import { readMeridiem, settleMeridiem } from "../src/lib/meridiem.js";
import { busyOn, freeSlots, findClash, goalSessions } from "../src/lib/schedule.js";
import { dailyBrief, unplanned } from "../src/lib/brief.js";
import { objection, requiresConfirmation } from "../src/lib/pushback.js";
import { displacementCost } from "../src/lib/pressure.js";
import { rollOverMissed } from "../src/lib/backlog.js";
import { topUpGoals } from "../src/lib/topup.js";
import { observations } from "../src/lib/patterns.js";
import { suggestions } from "../src/lib/suggest.js";
import { parseCalendar } from "../src/lib/calendar.js";
import { today, addDays, toMin, fromMin, isYmd } from "../src/lib/time.js";

const RUNS = 400;

// mulberry32: small, fast and good enough to explore input space reproducibly.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gen(seed) {
  const r = rng(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (xs) => xs[int(0, xs.length - 1)];
  const base = today();
  const date = () => addDays(base, int(-3, 10));
  const clock = () => fromMin(int(0, 95) * 15);
  const words = [
    "learn", "rust", "gym", "essay", "call", "mum", "remind", "me", "to", "in", "at", "by", "on",
    "tmrw", "tomorrow", "today", "tonight", "friday", "sat", "nav", "march", "next", "week", "month",
    "2", "20", "5", "9am", "5pm", "17:30", "mins", "hrs", "wks", "days", "an", "hour", "half", "noon",
    "lowk", "wanna", "gotta", "ion", "idk", "fr", "ngl", "the", "a", "", "  ", "!!", "@#$", "😭", "\n",
    "remember", "ping", "nudge", "dont", "let", "forget", "please", "can", "you", "0", "99999", "-5", "24:00",
  ];
  const text = () => Array.from({ length: int(0, 9) }, () => pick(words)).join(" ");
  const id = () => `x${int(0, 1e9)}`;
  const item = () => ({
    id: id(), title: pick(["Learn Rust", "Physics pset", "Essay", "Gym", "Portfolio"]),
    status: pick(["active", "active", "active", "done"]),
    category: pick(["skill", "task", "habit", "idea", "explore"]),
    priority: pick(["high", "medium", "low", undefined]),
    deadline: new Date(`${date()}T${clock()}:00`).toISOString(),
    createdAt: new Date(`${base}T08:00:00`).toISOString(),
    nudges: [],
  });
  return { r, int, pick, base, date, clock, text, id, item };
}

// Valid by construction: a random entry is kept only if it clashes with nothing already kept,
// so any overlap found afterwards was made by the code under test, not by the generator.
function plan(g, { blocks = 12, events = 4, items = [] } = {}) {
  const state = {
    fixed: [{ id: "school", title: "School", days: [1, 2, 3, 4, 5], start: "08:00", end: "14:00" }],
    blocks: [], events: [], reminders: [], memories: [], findings: [],
  };
  for (let i = 0; i < events; i++) {
    const e = { id: `ics:${g.id()}`, title: "Event", date: g.date(), start: g.clock(), minutes: g.pick([30, 60, 90]) };
    if (toMin(e.start) + e.minutes <= 24 * 60 && !findClash(state, e.date, toMin(e.start), e.minutes)) state.events.push(e);
  }
  for (let i = 0; i < blocks; i++) {
    const owner = items.length && g.r() < 0.6 ? g.pick(items).id : null;
    const b = { id: g.id(), itemId: owner, title: "Session", date: g.date(), start: g.clock(), minutes: g.pick([30, 45, 60, 90]), done: g.r() < 0.2 };
    if (toMin(b.start) + b.minutes <= 24 * 60 && !findClash(state, b.date, toMin(b.start), b.minutes)) state.blocks.push(b);
  }
  return state;
}

const DIRTY = /\bundefined\b|\bNaN\b|\bnull\b|\[object /;
const clean = (label, text, seed) =>
  assert.ok(typeof text === "string" && !DIRTY.test(text), `seed ${seed}: ${label} said ${JSON.stringify(text)}`);

// Every pair of busy things on every date in the plan, sessions against everything.
function assertNoDoubleBooking(state, seed, label) {
  const dates = new Set([...state.blocks.map((b) => b.date), ...state.events.map((e) => e.date)]);
  for (const date of dates) {
    const live = busyOn({ ...state, blocks: state.blocks.filter((b) => !b.done) }, date);
    for (let i = 1; i < live.length; i++) {
      assert.ok(live[i].s >= live[i - 1].e || live[i - 1].kind !== "block" && live[i].kind !== "block",
        `seed ${seed}: ${label} double-booked ${date}: ${live[i - 1].title} ${fromMin(live[i - 1].s)}-${fromMin(live[i - 1].e)} and ${live[i].title} ${fromMin(live[i].s)}`);
    }
  }
}

test("a blurt always becomes a titled goal with a future deadline", () => {
  for (let seed = 1; seed <= RUNS * 3; seed++) {
    const g = gen(seed);
    const raw = g.text();
    const item = parseBlurt(raw, Date.now());
    clean("title", item.title, seed);
    assert.ok(!isNaN(new Date(item.deadline)), `seed ${seed}: bad deadline for ${JSON.stringify(raw)}`);
    assert.ok(item.timeframeMs >= 60_000, `seed ${seed}: ${JSON.stringify(raw)} gave ${item.timeframeMs}ms`);
  }
});

test("a reminder is either not one, or has words and a time that is still to come", () => {
  const now = Date.now();
  for (let seed = 1; seed <= RUNS * 3; seed++) {
    const g = gen(seed);
    const raw = `${g.pick(["remind me to", "remind me", "ping me", "remember to", ""])} ${g.text()}`;
    const reminder = parseReminder(raw, now);
    if (reminder === null) continue;
    clean("reminder", reminder.text, seed);
    assert.ok(reminder.text.trim().length > 0, `seed ${seed}: empty reminder from ${JSON.stringify(raw)}`);
    assert.ok(reminder.at === null || (Number.isFinite(reminder.at) && reminder.at > now),
      `seed ${seed}: ${JSON.stringify(raw)} -> at ${reminder.at}`);
    if (reminder.at) clean("when", whenSaid(reminder.at, now), seed);
    const done = completeReminder(reminder.text, g.text(), now);
    assert.ok(done === null || (done.at > now && done.text === reminder.text), `seed ${seed}: completion went wrong`);
  }
});

// True if `out` is `raw` with `added` inserted at one place and nothing else changed.
const insertedOnce = (raw, out, added) =>
  [...out.matchAll(new RegExp(added, "g"))].some((m) => out.slice(0, m.index) + out.slice(m.index + m[0].length) === raw);

test("am or pm is only ever added to the hour they wrote, or asked about", () => {
  for (let seed = 1; seed <= RUNS * 3; seed++) {
    const g = gen(seed);
    const raw = `${g.text()} at ${g.int(0, 13)}${g.pick(["", ":30", ":05"])} ${g.text()}`;
    const now = new Date();
    now.setHours(g.int(0, 23), g.int(0, 59), 0, 0);
    const read = readMeridiem(raw, now);
    if (read === null) continue;
    if (read.ask) {
      assert.match(read.ask, /^\d{1,2}(:\d{2})?am or \d{1,2}(:\d{2})?pm\?$/, `seed ${seed}: ${read.ask}`);
      const settled = settleMeridiem(raw, g.pick(["am", "pm", "morning", "tonight", "nah"]), now);
      assert.ok(settled === null || insertedOnce(raw, settled, " ?[ap]m"), `seed ${seed}: ${JSON.stringify(raw)} -> ${settled}`);
    } else {
      assert.ok(insertedOnce(raw, read.text, " ?pm"), `seed ${seed}: ${JSON.stringify(raw)} -> ${read.text}`);
    }
  }
});

test("free slots never overlap anything busy, and the clash check agrees with them", () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const g = gen(seed);
    const state = plan(g);
    const date = g.date();
    const minutes = g.pick([15, 30, 60, 120]);
    const earliest = g.int(0, 12) * 60;
    const latest = Math.min(24 * 60, earliest + g.int(1, 16) * 60);
    const slots = freeSlots(state, date, minutes, earliest, latest, false);
    const busy = busyOn(state, date);
    let previousEnd = -1;
    for (const slot of slots) {
      const s = toMin(slot.start);
      const e = toMin(slot.end);
      assert.ok(e - s >= minutes, `seed ${seed}: ${slot.start}-${slot.end} shorter than ${minutes}`);
      assert.ok(s >= earliest && e <= latest, `seed ${seed}: ${slot.start}-${slot.end} outside window`);
      assert.ok(s >= previousEnd, `seed ${seed}: slots overlap each other`);
      previousEnd = e;
      for (const b of busy) assert.ok(e <= b.s || s >= b.e, `seed ${seed}: slot ${slot.start} overlaps ${b.title} ${fromMin(b.s)}`);
      assert.equal(findClash(state, date, s, minutes), undefined, `seed ${seed}: clash check disagrees at ${slot.start}`);
    }
  }
});

test("a goal's sessions land only in free time", () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const g = gen(seed);
    const state = plan(g);
    for (const session of goalSessions(state, { fromDate: g.base, due: addDays(g.base, g.int(0, 20)), minutes: g.pick([30, 60]) })) {
      assert.equal(findClash(state, session.date, toMin(session.start), session.minutes), undefined,
        `seed ${seed}: session ${session.date} ${session.start} lands on something`);
    }
  }
});

test("the daily rollover and goal top-up never double-book", () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const g = gen(seed);
    const items = Array.from({ length: g.int(0, 5) }, g.item);
    const state = plan(g, { items });
    const { state: rolled } = rollOverMissed(state, g.base, g.int(0, 24 * 60 - 1));
    assertNoDoubleBooking(rolled, seed, "rollover");
    const { state: topped } = topUpGoals(rolled, items, g.base);
    assertNoDoubleBooking(topped, seed, "top-up");
  }
});

test("everything she says out loud is clean text", () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const g = gen(seed);
    const items = Array.from({ length: g.int(0, 6) }, g.item);
    const state = plan(g, { items });
    const nowMinutes = g.int(0, 24 * 60 - 1);
    const date = g.date();

    clean("brief", dailyBrief({ items, plan: state, date, nowMinutes }).text, seed);
    clean("brief with findings", dailyBrief({ items, plan: state, date, nowMinutes, newFindings: [] }).text, seed);
    // null means "nothing to object to"; both callers ask requiresConfirmation first, so the
    // two have to agree exactly or a null would be read out as her objection.
    const objecting = objection(items, date);
    assert.equal(objecting !== null, requiresConfirmation(items, date), `seed ${seed}: objection and requiresConfirmation disagree`);
    if (objecting !== null) clean("objection", objecting, seed);
    for (const o of observations({ items, plan: state, date })) clean("pattern", o.text, seed);
    for (const s of suggestions({ items, plan: state, date, nowMinutes })) clean("suggestion", s.text ?? JSON.stringify(s), seed);
    for (const u of unplanned(items, state.blocks)) clean("unplanned", u.title, seed);

    const cost = displacementCost(state, items, { date, start: g.clock(), minutes: 60 }, g.base);
    if (cost) clean("displacement", cost.warning, seed);
  }
});

test("any feed yields only well-formed busy time inside the window", () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const g = gen(seed);
    const stamp = (d, c) => `${d.replaceAll("-", "")}T${c.replace(":", "")}00`;
    const events = Array.from({ length: g.int(0, 6) }, (_, i) => {
      const d = g.date();
      const lines = [
        "BEGIN:VEVENT", `UID:e${i}-${seed}@fuzz`,
        g.r() < 0.15 ? `DTSTART;VALUE=DATE:${d.replaceAll("-", "")}` : `DTSTART;TZID=Asia/Dubai:${stamp(d, g.clock())}`,
        g.r() < 0.1 ? "DTEND:99991231T235900Z" : `DTEND;TZID=Asia/Dubai:${stamp(addDays(d, g.int(0, 1)), g.clock())}`,
        `SUMMARY:${g.text().replace(/\n/g, " ") || "Thing"}`,
      ];
      if (g.r() < 0.4) lines.push(`RRULE:FREQ=${g.pick(["DAILY", "WEEKLY", "HOURLY", "MINUTELY"])}${g.r() < 0.5 ? `;COUNT=${g.int(1, 50)}` : ""}`);
      if (g.r() < 0.1) lines.push("STATUS:CANCELLED");
      if (g.r() < 0.1) lines.push("GARBAGE LINE WITH NO COLON");
      lines.push("END:VEVENT");
      return lines.join("\n");
    });
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\n");
    const end = addDays(g.base, 14);
    for (const e of parseCalendar(ics, g.base, 14)) {
      assert.ok(isYmd(e.date) && e.date >= g.base && e.date < end, `seed ${seed}: entry dated ${e.date}`);
      assert.doesNotThrow(() => toMin(e.start), `seed ${seed}: start ${e.start}`);
      assert.ok(e.minutes > 0 && toMin(e.start) + e.minutes <= 24 * 60, `seed ${seed}: ${e.start} for ${e.minutes}m`);
      assert.ok(!/[\n\r]/.test(e.title) && e.title.length <= 80, `seed ${seed}: title ${JSON.stringify(e.title)}`);
    }
  }
});
