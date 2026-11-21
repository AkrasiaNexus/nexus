import { useEffect, useRef } from "react";
import { dueNudges } from "../lib/nudges";
import { dueReminders, blockStartMs } from "../lib/reminders";
import { dueRemindersAt, msUntilNext } from "../lib/remind";
import { getNudgeMessage, getReminderMessage } from "../lib/nudgeMessages";
import { notify, revealOrb } from "../lib/notify";
import { planStore } from "../stores/planStore";
import { shouldResearch, researchOnce } from "../lib/nightly";
import { refreshCalendar, shouldRefreshCalendar } from "../lib/calendar";
import { today, nowMin } from "../lib/time";

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
      const { blocks, reminders } = planStore.getAll();

      const sessionReminders = dueReminders(blocks, since, now);
      for (const block of sessionReminders) {
        notify("Donna", getReminderMessage(block.title, Math.round((blockStartMs(block) - now) / MINUTE_MS)));
      }
      // A two-minute job you asked to be reminded of fires even if slept through:
      // forgetting it is the whole reason it exists.
      // Fired once, but left outstanding: it stays in the orb until it's ticked off,
      // because a notification you missed is the thing forgotten all over again.
      const nudged = dueRemindersAt(reminders, since, now);
      for (const r of nudged) notify("Donna", r.text);

      // The orb appears unfocused, so it never swallows what you're typing elsewhere.
      if (sessionReminders.length || nudged.length) revealOrb();

      // Deadline check-ins still cover anything that hasn't been given a time yet.
      const scheduled = new Set(blocks.filter((b) => !b.done).map((b) => b.itemId));
      for (const { item, nudge } of dueNudges(itemsRef.current, since, now)) {
        if (scheduled.has(item.id)) continue;
        notify("Donna", getNudgeMessage(nudge.tone, item.title));
      }

      // Before the sweep books anything: a lesson added to the calendar this morning has to
      // be busy time before a goal gets topped up into it.
      if (shouldRefreshCalendar(planStore.getAll(), now)) {
        refreshCalendar(today()).then((events) => planStore.setEvents(events));
      }

      planStore.sweep(itemsRef.current);

      // She works while you're asleep. Fire and forget: the tick must not wait on a search,
      // and a night that turns up nothing is still a night that ran.
      const plan = planStore.getAll();
      if (shouldResearch(plan, today(), nowMin())) {
        researchOnce({ items: itemsRef.current, memories: plan.memories, findings: plan.findings })
          .then(({ found }) => planStore.recordFindings(today(), found))
          .catch(() => planStore.recordFindings(today(), []));
      }

      try {
        localStorage.setItem(LAST_CHECK_KEY, String(now));
      } catch {
        // storage blocked: nudges may repeat after a reload, which beats losing them
      }
      // Firing a reminder changes nothing in the plan, so the one after it is aimed here.
      aimAtNext();
    }
    // The minute tick can land up to a minute after a reminder is due, so "remind me in 1 min"
    // arrived nearly two minutes later. A one-off timer is aimed at the next reminder whenever
    // the plan changes — including the moment one is saved.
    let aimed = null;
    function aimAtNext() {
      clearTimeout(aimed);
      const wait = msUntilNext(planStore.getAll().reminders);
      if (wait !== null && wait < TICK_MS) aimed = setTimeout(tick, wait + 250);
    }

    tick();
    const id = setInterval(tick, TICK_MS);
    const stopAiming = planStore.subscribe(aimAtNext);
    // A safety net for when the timer was held back anyway — macOS before 14 ignores the
    // no-throttling setting: the moment the window is shown, anything that came due while it
    // was suspended fires then, instead of up to a minute later.
    const onShow = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(id);
      clearTimeout(aimed);
      stopAiming();
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
}
