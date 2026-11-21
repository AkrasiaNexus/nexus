import { parseYmd, toMin, fromMin, today, nowMin, addDays } from "./time.js";

export const DAY_START = 7 * 60;
export const DAY_END = 23 * 60;
const SLOT_STEP = 15;
// Book goals two weeks out at most; a month-long goal shouldn't carpet the whole calendar.
export const MAX_GOAL_DAYS = 14;
const EVENT_LABEL = "a calendar commitment";

// Everything already taken on a date: weekly fixed commitments, booked blocks, and whatever
// the subscribed calendar says. Events are read-only, so nothing here may move or drop one.
export function busyOn(state, date) {
  const weekday = parseYmd(date).getDay();
  const taken = [];
  for (const f of state.fixed) {
    if (f.days.includes(weekday)) taken.push({ s: toMin(f.start), e: toMin(f.end), title: f.title, label: f.title, kind: "fixed", id: f.id });
  }
  for (const b of state.blocks) {
    if (b.date !== date) continue;
    const start = toMin(b.start);
    taken.push({ s: start, e: start + b.minutes, title: b.title, label: b.title, kind: "block", id: b.id });
  }
  // A plan saved before the calendar existed has no events, and tests build state by hand.
  for (const e of state.events ?? []) {
    if (e.date !== date) continue;
    const start = toMin(e.start);
    // `label` is what may be said out loud or put in front of the model; `title` is only ever
    // drawn. A feed's own words never reach a prompt, because whoever can add an event to the
    // calendar — a shared one, an auto-accepted invite — would otherwise be writing to it.
    taken.push({ s: start, e: start + e.minutes, title: e.title, label: EVENT_LABEL, kind: "event", id: e.id });
  }
  return taken.sort((a, b) => a.s - b.s);
}

// Gaps of at least `minutes` between earliest and latest, around everything busy.
export function freeSlots(state, date, minutes, earliest = DAY_START, latest = DAY_END, clampToNow = true) {
  let cursor = earliest;
  if (clampToNow && date === today()) cursor = Math.max(cursor, Math.ceil(nowMin() / SLOT_STEP) * SLOT_STEP);

  const gaps = [];
  for (const b of busyOn(state, date)) {
    if (b.e <= cursor) continue;
    if (b.s - cursor >= minutes && b.s <= latest) gaps.push({ date, start: fromMin(cursor), end: fromMin(Math.min(b.s, latest)) });
    cursor = Math.max(cursor, b.e);
  }
  if (latest - cursor >= minutes) gaps.push({ date, start: fromMin(cursor), end: fromMin(latest) });

  return gaps.filter((g) => toMin(g.end) - toMin(g.start) >= minutes);
}

// The first thing a proposed block would overlap, or undefined if it fits.
export function findClash(state, date, startMin, minutes, ignoreId) {
  return busyOn(state, date).find((b) => b.id !== ignoreId && startMin < b.e && b.s < startMin + minutes);
}

// A goal's sessions: one a day, in each day's first free gap, from `fromDate` to `due`.
// Days are independent, so no slot can clash with another session from the same call.
export function goalSessions(state, { fromDate, due, minutes }) {
  const sessions = [];
  for (let date = fromDate, i = 0; date <= due && i < MAX_GOAL_DAYS; date = addDays(date, 1), i++) {
    const slot = freeSlots(state, date, minutes)[0];
    if (slot) sessions.push({ date, start: slot.start, minutes });
  }
  return sessions;
}
