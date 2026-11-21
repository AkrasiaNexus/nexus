import { parseYmd, toMin } from "./time.js";

// How long before a session starts Donna speaks up.
export const LEAD_MINUTES = 5;

const MINUTE_MS = 60_000;

export function blockStartMs(block) {
  return parseYmd(block.date).getTime() + toMin(block.start) * MINUTE_MS;
}

// Reminders whose lead moment fell in (since, now], soonest first. A session that
// already ended is a miss for the end-of-day sweep, not something to announce late.
export function dueReminders(blocks, since, now, leadMinutes = LEAD_MINUTES) {
  return blocks
    .filter((b) => {
      if (b.done) return false;
      const start = blockStartMs(b);
      const speakAt = start - leadMinutes * MINUTE_MS;
      return speakAt > since && speakAt <= now && start + b.minutes * MINUTE_MS > now;
    })
    .sort((a, b) => blockStartMs(a) - blockStartMs(b));
}
