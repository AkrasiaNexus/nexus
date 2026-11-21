import { parseYmd, ymd, WEEKDAYS } from "./time.js";

// Thresholds, because the point of a pattern is that it is one. Two missed sessions is a
// fortnight; three is a habit, and worth saying out loud.
const SKIPS_BEFORE_SAYING = 3;
const DEAD_DAY_MISSES = 3;
const UNTOUCHED_DAYS = 7;
const STREAK = 4;
const MOST = 2;

const daysBetween = (from, to) => Math.round((parseYmd(to) - parseYmd(from)) / 86_400_000);

// What Donna would have noticed without being asked. She has the whole history; saying
// nothing about it is the difference between a calendar and someone who pays attention.
export function observations({ items, plan, date }) {
  const live = items.filter((i) => i.status === "active");
  const past = plan.blocks.filter((b) => b.date < date);
  const found = [];

  for (const item of live) {
    const mine = past.filter((b) => b.itemId === item.id);
    const missed = mine.filter((b) => !b.done);

    // A weekday you have never once delivered on. The most useful thing here, because it
    // is a fact about when you work rather than about whether you tried.
    const byWeekday = new Map();
    for (const b of mine) {
      const day = parseYmd(b.date).getDay();
      const seen = byWeekday.get(day) ?? { total: 0, done: 0 };
      byWeekday.set(day, { total: seen.total + 1, done: seen.done + (b.done ? 1 : 0) });
    }
    for (const [day, { total, done }] of byWeekday) {
      if (total >= DEAD_DAY_MISSES && done === 0) {
        found.push({
          kind: "deadDay", itemId: item.id,
          text: `${total} ${WEEKDAYS[day].toLowerCase()}s booked for ${item.title.toLowerCase()}, ${total} missed. want me to stop booking ${WEEKDAYS[day].toLowerCase()}s?`,
        });
      }
    }

    if (missed.length >= SKIPS_BEFORE_SAYING && missed.length === mine.length) {
      found.push({
        kind: "skipped", itemId: item.id,
        text: `you've skipped ${item.title.toLowerCase()} ${missed.length} times now. move it somewhere you'll actually do it, or drop it?`,
      });
    }

    // Nothing booked at all, not merely nothing done yet: a goal with sessions waiting
    // ahead of it has been dealt with, and nagging about it would just be wrong.
    const everBooked = plan.blocks.some((b) => b.itemId === item.id);
    const age = daysBetween(ymd(new Date(item.createdAt)), date);
    if (!everBooked && age >= UNTOUCHED_DAYS) {
      found.push({
        kind: "neverStarted", itemId: item.id,
        text: `${item.title.toLowerCase()} has been on the list ${age} days and you haven't touched it once.`,
      });
    }

    const run = streakLength(mine, date);
    if (run >= STREAK) {
      found.push({ kind: "streak", itemId: item.id, text: `${run} days straight on ${item.title.toLowerCase()}. don't break it now.` });
    }
  }

  const rank = { deadDay: 0, skipped: 1, neverStarted: 2, streak: 3 };
  return found.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, MOST);
}

// Consecutive finished sessions counting back from the most recent.
function streakLength(mine, date) {
  const recent = [...mine].sort((a, b) => b.date.localeCompare(a.date));
  let run = 0;
  for (const block of recent) {
    if (block.date >= date || !block.done) break;
    run += 1;
  }
  return run;
}
