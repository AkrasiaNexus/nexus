import { parseYmd, toMin } from "./time.js";

// How long before a session starts Donna speaks up.
export const LEAD_MINUTES = 5;

const MINUTE_MS = 60_000;
// Set for under 45 minutes away, it comes up on its minute; up to two hours, five minutes early;
// further out, ten. Counted from when you told her, so "in 5 mins" never arrives early.
const ON_TIME_UNDER_MS = 45 * MINUTE_MS;
const NEAR_MS = 120 * MINUTE_MS;

// Minutes of warning before `atMs`. `fallback` is for things saved before `setAt` existed.
export function leadFor(atMs, setAt, fallback = LEAD_MINUTES) {
  if (!Number.isFinite(setAt)) return fallback;
  const away = atMs - setAt;
  return away < ON_TIME_UNDER_MS ? 0 : away <= NEAR_MS ? 5 : 10;
}

export function blockStartMs(block) {
  return parseYmd(block.date).getTime() + toMin(block.start) * MINUTE_MS;
}

// Reminders whose lead moment fell in (since, now], soonest first. A session that
// already ended is a miss for the end-of-day sweep, not something to announce late.
export function dueReminders(blocks, since, now) {
  return blocks
    .filter((b) => {
      if (b.done) return false;
      const start = blockStartMs(b);
      const speakAt = start - leadFor(start, b.setAt) * MINUTE_MS;
      return speakAt > since && speakAt <= now && start + b.minutes * MINUTE_MS > now;
    })
    .sort((a, b) => blockStartMs(a) - blockStartMs(b));
}

// Sessions to hold up in the orb: from the lead moment until they end, unless answered. Every
// session warns this way, so a "call mum at 3" works whether it was booked or set as a reminder.
export function startingSoon(blocks, now) {
  return blocks
    .filter((b) => {
      if (b.done || b.answered) return false;
      const start = blockStartMs(b);
      return start - leadFor(start, b.setAt) * MINUTE_MS <= now && start + b.minutes * MINUTE_MS > now;
    })
    .sort((a, b) => blockStartMs(a) - blockStartMs(b));
}
