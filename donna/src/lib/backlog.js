import { addDays, toMin } from "./time.js";
import { freeSlots, DAY_START, DAY_END } from "./schedule.js";

const hasEnded = (block, onDate, nowMinutes) => block.date < onDate || toMin(block.start) + block.minutes <= nowMinutes;

// A week covers a weekend away. Past that a miss is history: the moment has gone, and its
// goal is booked fresh sessions by the top-up anyway, so carrying it forward only duplicates.
const STALE_AFTER_DAYS = 7;
// Catching up, not drowning. Before this, coming back after two weeks put all fourteen missed
// sessions on one day, 07:00 to 21:00 solid.
const MAX_CARRIED = 3;

// End-of-day sweep: anything missed recently becomes tomorrow's first job, in the order it
// was meant to happen. A session with nowhere to go tomorrow — no room, or past the cap — keeps
// its slot but is still flagged, so it shows as backlog rather than disappearing.
export function rollOverMissed(state, onDate, nowMinutes) {
  const target = addDays(onDate, 1);
  const since = addDays(onDate, -STALE_AFTER_DAYS);
  const missed = state.blocks
    .filter((b) => !b.done && b.date >= since && b.date <= onDate && hasEnded(b, onDate, nowMinutes))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  if (!missed.length) return { state, moved: [] };

  // The most recent are the ones still worth doing; the rest are flagged where they stand.
  const carried = missed.slice(-MAX_CARRIED);
  let next = { ...state, blocks: state.blocks.filter((b) => !missed.includes(b)) };
  const moved = [];

  for (const block of missed) {
    const slot = carried.includes(block) && freeSlots(next, target, block.minutes, DAY_START, DAY_END, false)[0];
    const placed = slot
      // Skipped today is not skipped tomorrow: it warns again where it lands.
      ? { ...block, date: target, start: slot.start, isBacklog: true, answered: false }
      : { ...block, isBacklog: true };
    if (slot) moved.push(placed);
    next = { ...next, blocks: [...next.blocks, placed] };
  }

  return { state: next, moved };
}
