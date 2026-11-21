import { parseYmd, toMin, fromMin, today, nowMin } from "./time.js";

export const DAY_START = 7 * 60;
export const DAY_END = 23 * 60;
const SLOT_STEP = 15;

// Everything already taken on a date: weekly fixed commitments plus booked blocks.
export function busyOn(state, date) {
  const weekday = parseYmd(date).getDay();
  const taken = [];
  for (const f of state.fixed) {
    if (f.days.includes(weekday)) taken.push({ s: toMin(f.start), e: toMin(f.end), title: f.title, kind: "fixed", id: f.id });
  }
  for (const b of state.blocks) {
    if (b.date !== date) continue;
    const start = toMin(b.start);
    taken.push({ s: start, e: start + b.minutes, title: b.title, kind: "block", id: b.id });
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
