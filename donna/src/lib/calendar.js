import ICAL from "ical.js";
import { isTauri } from "./notify.js";

// The window the calendar is kept warm for: a fortnight, which is how far goals are booked.
const CALENDAR_DAYS = 14;
// Often enough that a lesson added this morning is known by this afternoon, rarely enough
// that a laptop on a hotspot is not fetching a feed every minute.
const REFRESH_MS = 15 * 60_000;
// How far a recurrence rule is walked before the feed is judged broken (see occurrences).
const MAX_STEPS = 10_000;
// A fortnight cannot hold more than this many commitments; a feed that says otherwise is
// broken, and building its entries would stall the window it is drawing.
const MAX_PER_EVENT = 500;
const MAX_ENTRIES = 2_000;

// The feed address grants read access to the whole calendar, so it is a secret: its own key,
// never inside `donna_plan`, so it can never ride along into a model prompt. Set it with
// VITE_CALENDAR_URL at build time, or once on this machine.
const URL_STORE = "donna_calendar_url";

export function calendarUrl() {
  const fromBuild = import.meta.env?.VITE_CALENDAR_URL;
  if (fromBuild) return fromBuild;
  try {
    return localStorage.getItem(URL_STORE) || null;
  } catch {
    return null;
  }
}

export const shouldRefreshCalendar = (plan, now) => now - (plan.calendarAt ?? 0) >= REFRESH_MS;

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;

const ymd = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// A title comes off a remote feed, so it is untrusted text. It is stripped of anything that
// could pose as structure — line breaks and control characters — and capped, because it ends up
// both in the DOM and in strings a local model reads. See `label` in schedule.js for the rest.
const TITLE_MAX = 80;
const clean = (title) =>
  (title ?? "").replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").trim().slice(0, TITLE_MAX) || "busy";

const hhmm = (date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const minutesIntoDay = (date) => date.getHours() * 60 + date.getMinutes();

// A feed carries its own zone definitions; without registering them ical.js reads a zoned
// time as if it were UTC, which silently moves every lesson by the offset.
function registerZones(root) {
  for (const vtimezone of root.getAllSubcomponents("vtimezone")) {
    const zone = new ICAL.Timezone(vtimezone);
    if (!ICAL.TimezoneService.has(zone.tzid)) ICAL.TimezoneService.register(zone.tzid, zone);
  }
}

// One occurrence can cover more than one day, and a day is what the calendar reasons in, so
// an overnight event is cut at midnight into one entry per day it touches.
function split(id, title, start, end) {
  const entries = [];
  for (let day = start; day < end; ) {
    const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    const until = end < midnight ? end : midnight;
    const minutes = Math.round((until - day) / MINUTE_MS);
    if (minutes > 0) {
      entries.push({
        id: `ics:${id}:${ymd(day)}:${hhmm(day)}`,
        title,
        date: ymd(day),
        start: hhmm(day),
        minutes: Math.min(minutes, DAY_MINUTES - minutesIntoDay(day)),
      });
    }
    day = midnight;
  }
  return entries;
}

// An occurrence counts when it overlaps the window, not when it starts in it: something that
// began on Sunday and runs into Tuesday is still busy on Tuesday. Each one is clamped to the
// window, so a feed claiming an event ends in the year 9999 costs a fortnight of days, not
// three million of them.
const overlap = (start, end, from, to) =>
  end > from && start < to ? [[start < from ? from : start, end > to ? to : end]] : [];

function occurrences(event, from, to) {
  if (!event.isRecurring()) {
    return overlap(event.startDate.toJSDate(), event.endDate.toJSDate(), from, to);
  }

  const found = [];
  const iterator = event.iterator();
  // A rule is walked one step at a time from the date it starts, so an endless fine-grained
  // one (FREQ=SECONDLY dated years back) reaches the window only after millions of steps and
  // freezes the week it is drawing. 10,000 steps covers 27 years of a daily rule; a feed that
  // needs more than that is broken rather than busy, so its event is dropped.
  let step = 0;
  for (let next = iterator.next(); next; next = iterator.next()) {
    if (step++ >= MAX_STEPS) {
      // Never silent: giving up means the event disappears and its hours read as free, which
      // is the one outcome this whole feature exists to prevent.
      console.warn("donna: gave up expanding a recurring event — the feed's rule is too fine-grained to use");
      break;
    }
    const { startDate, endDate } = event.getOccurrenceDetails(next);
    const start = startDate.toJSDate();
    if (start >= to) break;
    found.push(...overlap(start, endDate.toJSDate(), from, to));
    if (found.length >= MAX_PER_EVENT) break;
  }
  return found;
}

// Busy stretches from an iCalendar feed, in the same shape as a booked session so the
// calendar can treat them alike. `days` counts from `fromDate` inclusive.
export function parseCalendar(icsText, fromDate, days) {
  const [y, m, d] = fromDate.split("-").map(Number);
  const from = new Date(y, m - 1, d);
  const to = new Date(y, m - 1, d + days);

  let components;
  try {
    const root = new ICAL.Component(ICAL.parse(icsText));
    registerZones(root);
    components = root.getAllSubcomponents("vevent");
  } catch (err) {
    // A feed that cannot be read must not take the week with it: a stale calendar beats none,
    // and the warning is here so a feed that silently stops working can be found.
    console.warn("donna: the calendar feed could not be read", err);
    return [];
  }

  const busy = [];
  for (const component of components) {
    try {
      const event = new ICAL.Event(component);
      // Cancelled entries stay on a feed but are not commitments.
      if (component.getFirstPropertyValue("status") === "CANCELLED") continue;
      // An all-day entry is usually a holiday, which frees the day rather than filling it.
      if (event.startDate.isDate) continue;

      for (const [start, end] of occurrences(event, from, to)) {
        // Pushed one at a time: spreading a very large array overflows the call stack, and that
        // throw was caught below, so the event disappeared and its hours read as free.
        for (const entry of split(event.uid, clean(event.summary), start, end)) busy.push(entry);
      }
      if (busy.length >= MAX_ENTRIES) {
        console.warn("donna: the calendar feed has more entries than a fortnight can hold; the rest were ignored");
        break;
      }
    } catch (err) {
      // One malformed entry among fifty should cost that entry, not the rest of the week.
      console.warn("donna: skipped a calendar entry that could not be read", err);
    }
  }
  return busy.filter((e) => e.date >= fromDate && e.date < ymd(to));
}

// Reads the subscribed feed and turns it into busy time. Null means there is nothing to show
// for this attempt — no feed set, or the fetch failed — so the caller keeps what it already
// has rather than emptying the week on one bad connection.
export async function refreshCalendar(fromDate) {
  const url = calendarUrl();
  if (!url || !isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return parseCalendar(await invoke("fetch_calendar", { url }), fromDate, CALENDAR_DAYS);
  } catch (cause) {
    // Never silent: a feed that quietly stops working looks exactly like a free afternoon.
    console.warn("donna: the calendar feed could not be fetched", cause);
    return null;
  }
}
