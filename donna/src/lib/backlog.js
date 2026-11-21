import { addDays, toMin } from "./time.js";
import { freeSlots, DAY_START, DAY_END } from "./schedule.js";

const hasEnded = (block, onDate, nowMinutes) => block.date < onDate || toMin(block.start) + block.minutes <= nowMinutes;

// End-of-day sweep: anything missed becomes tomorrow's first job, in the order it was
// meant to happen. A session with nowhere to go tomorrow keeps its slot but is still
// flagged, so it shows as backlog rather than disappearing.
// shortcut: only looks one day ahead; upgrade when a day can fill up with backlog alone.
export function rollOverMissed(state, onDate, nowMinutes) {
  const target = addDays(onDate, 1);
  const missed = state.blocks
    .filter((b) => !b.done && b.date <= onDate && hasEnded(b, onDate, nowMinutes))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  if (!missed.length) return { state, moved: [] };

  let next = { ...state, blocks: state.blocks.filter((b) => !missed.includes(b)) };
  const moved = [];

  for (const block of missed) {
    const slot = freeSlots(next, target, block.minutes, DAY_START, DAY_END, false)[0];
    const placed = slot
      ? { ...block, date: target, start: slot.start, isBacklog: true }
      : { ...block, isBacklog: true };
    if (slot) moved.push(placed);
    next = { ...next, blocks: [...next.blocks, placed] };
  }

  return { state: next, moved };
}
