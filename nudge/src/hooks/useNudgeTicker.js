import { useEffect, useRef } from "react";
import { dueNudges } from "../lib/nudges";
import { getNudgeMessage } from "../lib/nudgeMessages";
import { notify } from "../lib/notify";

const LAST_CHECK_KEY = "nudge_last_check";
const TICK_MS = 60_000;

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
      for (const { item, nudge } of dueNudges(itemsRef.current, readLastCheck(), now)) {
        notify("Nudge", getNudgeMessage(nudge.tone, item.title));
      }
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
