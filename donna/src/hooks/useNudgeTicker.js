import { useEffect, useRef } from "react";
import { dueNudges } from "../lib/nudges";
import { dueReminders, blockStartMs } from "../lib/reminders";
import { getNudgeMessage, getReminderMessage } from "../lib/nudgeMessages";
import { notify, revealPanel } from "../lib/notify";
import { planStore } from "../stores/planStore";

const LAST_CHECK_KEY = "nudge_last_check";
const TICK_MS = 60_000;
const MINUTE_MS = 60_000;

function readLastCheck() {
  try {
    return Number(localStorage.getItem(LAST_CHECK_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

export function useNudgeTicker(items) {
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const since = readLastCheck();
      const { blocks } = planStore.getAll();

      const reminders = dueReminders(blocks, since, now);
      for (const block of reminders) {
        notify("Donna", getReminderMessage(block.title, Math.round((blockStartMs(block) - now) / MINUTE_MS)));
      }
      // The panel appears unfocused, so it never swallows what you're typing elsewhere.
      if (reminders.length) revealPanel();

      // Deadline check-ins still cover anything that hasn't been given a time yet.
      const scheduled = new Set(blocks.filter((b) => !b.done).map((b) => b.itemId));
      for (const { item, nudge } of dueNudges(itemsRef.current, since, now)) {
        if (scheduled.has(item.id)) continue;
        notify("Donna", getNudgeMessage(nudge.tone, item.title));
      }

      planStore.sweep();

      try {
        localStorage.setItem(LAST_CHECK_KEY, String(now));
      } catch {
        // storage blocked: nudges may repeat after a reload, which beats losing them
      }
    }
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);
}
