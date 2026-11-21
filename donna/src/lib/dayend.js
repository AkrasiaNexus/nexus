import { toMin } from "./time.js";

// Late enough that the day is effectively over, early enough to still do something about it.
export const EVENING_FROM = toMin("21:00");

const hasEnded = (block, nowMinutes) => toMin(block.start) + block.minutes <= nowMinutes;

// Today's sessions that came and went without being ticked off, in the order the day ran.
export function unfinishedToday(plan, date, nowMinutes) {
  return plan.blocks
    .filter((b) => b.date === date && !b.done && hasEnded(b, nowMinutes))
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}

// The sweep moves anything missed to tomorrow on its own, silently. This is the chance to
// say "actually I did that one" first — asked once, in the evening, and only if there is
// something to ask about.
export function shouldAskAboutToday(plan, date, nowMinutes) {
  if (nowMinutes < EVENING_FROM) return false;
  if (plan.askedOn === date) return false;
  return unfinishedToday(plan, date, nowMinutes).length > 0;
}
