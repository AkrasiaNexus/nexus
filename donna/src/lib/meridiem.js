import * as chrono from "chrono-node";
import { isProse } from "./parser.js";
import { PART_OF_DAY } from "./remind.js";

// Nobody books 1 to 6 in the morning, so those hours are the afternoon. 7 to 11 could be either.
const LAST_SURE_PM = 6;
const ANSWER = /^(?:(\d{1,2})(?::\d{2})?\s*)?(a\.?m\.?|in the morning|morning|p\.?m\.?|in the afternoon|afternoon|in the evening|evening|at night|night|tonight)(?:\s+(?:pls|plz|please))?$/i;

const clock = (hour, minute) => (minute ? `${hour}:${String(minute).padStart(2, "0")}` : String(hour));

// "at 7", "tmrw at 7:30": an hour on the clock with nothing to say which half of the day.
function bareHour(text, now) {
  if (PART_OF_DAY.test(text)) return null;
  const hit = chrono.parse(text, now, { forwardDate: true })
    .find((h) => !isProse(h) && h.start.isCertain("hour") && !h.start.isCertain("meridiem"));
  if (!hit) return null;
  const hour = hit.start.get("hour");
  const minute = hit.start.get("minute") ?? 0;
  if (hour < 1 || hour > 11) return null;
  // Where the half goes: straight after the hour as they wrote it. No digits, nothing to settle.
  const time = [...hit.text.matchAll(/\d{1,2}(?::\d{2})?(?:\s*o'?\s?clock)?/gi)].find((m) => parseInt(m[0], 10) === hour);
  if (!time) return null;
  // chrono moves an unnamed day to tomorrow once the morning hour has gone; people mean today.
  const named = hit.start.isCertain("day") || hit.start.isCertain("weekday");
  const gap = /k$/i.test(time[0]) ? " " : "";
  return { end: hit.index + time.index + time[0].length, gap, hour, minute, day: named ? hit.start.date() : now };
}

const on = (day, hour, minute) => {
  const when = new Date(day);
  when.setHours(hour, minute, 0, 0);
  return when;
};

// In their own words, so the model has nothing left to guess.
const withHalf = (text, { end, gap }, half) => `${text.slice(0, end)}${gap}${half}${text.slice(end)}`;

// { text } with the half filled in when only one reading makes sense, { ask } when both do,
// or null when there is nothing to settle.
export function readMeridiem(text, now = new Date()) {
  const bare = bareHour(text, now);
  if (!bare) return null;
  const { hour, minute, day } = bare;
  // Both gone today: the booking tool says so, rather than this quietly moving it.
  if (on(day, hour + 12, minute) <= now) return null;
  if (on(day, hour, minute) <= now || hour <= LAST_SURE_PM) return { text: withHalf(text, bare, "pm") };
  return { ask: `${clock(hour, minute)}am or ${clock(hour, minute)}pm?` };
}

// The reply to "7am or 7pm?" finishes the message it was asked about. Anything else is a new
// message, and the question is let go rather than guessed at.
export function settleMeridiem(original, reply, now = new Date()) {
  const said = ANSWER.exec(reply.trim());
  const bare = said && bareHour(original, now);
  if (!bare || (said[1] && Number(said[1]) !== bare.hour)) return null;
  return withHalf(original, bare, /^(?:a\.?m|in the morning|morning)/i.test(said[2]) ? "am" : "pm");
}
