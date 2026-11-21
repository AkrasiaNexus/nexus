import * as chrono from "chrono-node";
import { WEEKDAYS } from "./time.js";
import { isProse } from "./parser.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
// A day named with no time ("tmrw", "friday") is most use at the start of that day.
const START_OF_DAY = 9;

// "remind me to…", "remind me in 20 mins to…", and the other ways people actually ask. The
// "to" is optional after "remind me" because the time often comes first.
const ASK = /^\s*(?:(?:can you|could you|pls|plz|please|yo)\s+)?(?:remind me|ping me|nudge me|don'?t let me forget|remember to)\b\s*(?:to\b\s*)?/i;
// Words that already place a time of day, so chrono's reading of them is kept as it is.
const PART_OF_DAY = /\b(?:morning|afternoon|evening|night|tonight|noon|midday|midnight|lunch)\b/i;
// "at 5" with no am or pm.
const BARE_HOUR = /^(?:at\s+)?(\d{1,2})(?::(\d{2}))?$/i;
// chrono sometimes leaves the word that introduced a time behind: "by 5pm" matches "5pm", "at
// noon" matches "noon". Only those are stripped, and only then: stripping on/in everywhere ate
// the end of "put the washing on", and stripping "by" before a word would eat "drop by tmrw".
const LEADS = /^(?:at|on|in|by|before|from|until)\b/i;
const DANGLING_AT = /\s+at\s*$/i;
const DANGLING_BY = /\s+(?:by|before)\s*$/i;

const titled = (text) =>
  text.replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

// The next time the clock shows h:m, taking h as either half of the day. Read literally,
// "at 5" said at 2pm was 05:00 the following morning — twelve hours late.
function nextOnClock(hour, minute, nowMs) {
  const candidates = [];
  for (const days of [0, 1]) {
    for (const h of [hour % 12, (hour % 12) + 12]) {
      const when = new Date(nowMs);
      when.setDate(when.getDate() + days);
      when.setHours(h, minute, 0, 0);
      if (when.getTime() > nowMs) candidates.push(when.getTime());
    }
  }
  return Math.min(...candidates);
}

// When a chrono reading should fire, or null if it doesn't name a usable moment.
function moment(hit, nowMs) {
  const bare = BARE_HOUR.exec(hit.text.trim());
  if (bare && Number(bare[1]) >= 1 && Number(bare[1]) <= 12) {
    return nextOnClock(Number(bare[1]), Number(bare[2] ?? 0), nowMs);
  }

  const when = hit.start.date();
  if (!hit.start.isCertain("hour") && !PART_OF_DAY.test(hit.text)) when.setHours(START_OF_DAY, 0, 0, 0);
  // A day named with a bare hour — "tomorrow at 5", "friday at 3" — read literally fired between
  // 03:00 and 06:00. People mean the waking day, so 1-6 is afternoon and 7-11 morning, the way
  // calendar apps read it. An explicit am or pm is always believed.
  else if (hit.start.isCertain("hour") && !hit.start.isCertain("meridiem") && !PART_OF_DAY.test(hit.text)) {
    const hour = when.getHours();
    if (hour >= 1 && hour <= 6) when.setHours(hour + 12);
  }
  // "today" said after nine names no moment left to fire at; it waits to be given one.
  return when.getTime() > nowMs ? when.getTime() : null;
}

// A two-minute job you'd otherwise forget. Deliberately not a calendar block: it takes no
// room in the week, it just arrives, gets done, and gets out of the way.
export function parseReminder(raw, nowMs = Date.now()) {
  if (!ASK.test(raw)) return null;

  let rest = raw.replace(ASK, "");
  let at = null;

  // The first reading that is a real time: in "fix the sat nav at 6pm", "sat" comes first.
  const hit = chrono.parse(rest, new Date(nowMs), { forwardDate: true }).find((h) => !isProse(h));
  if (hit) {
    at = moment(hit, nowMs);
    if (at !== null) {
      let before = rest.slice(0, hit.index);
      if (!LEADS.test(hit.text)) before = before.replace(DANGLING_AT, "");
      if (/^\d/.test(hit.text)) before = before.replace(DANGLING_BY, "");
      rest = `${before} ${rest.slice(hit.index + hit.text.length)}`;
    }
  }

  rest = rest.trim().replace(/^to\s+/i, "");

  const text = titled(rest);
  return text ? { text, at } : null;
}

// "remind me to call mum" -> "when?" -> "5pm". The reply completes the reminder only if it is
// nothing but a time, read by the same rules as a reminder given in one go; anything more is a
// new message, and the half-finished reminder is let go rather than guessed at.
export function completeReminder(pendingText, reply, nowMs = Date.now()) {
  // The likeliest answers are the shortest: "5" or "5:30" is a time on the clock, "in 5" minutes.
  const said = reply.trim();
  const read = /^\d{1,2}(?::\d{2})?$/.test(said) ? `at ${said}` : /^in\s+\d+$/i.test(said) ? `${said} mins` : said;
  const whole = parseReminder(`remind me to ${pendingText} ${read}`, nowMs);
  return whole?.at && whole.text === pendingText ? whole : null;
}

// How she says when, on the real clock, so a guess that is wrong is seen the moment she
// says it rather than when the reminder fails to arrive.
export function whenSaid(atMs, nowMs = Date.now()) {
  const minutes = Math.round((atMs - nowMs) / MINUTE_MS);
  if (atMs - nowMs <= HOUR_MS) return `in ${Math.max(1, minutes)} min${Math.max(1, minutes) === 1 ? "" : "s"}`;

  const when = new Date(atMs);
  const clock = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  return when.toDateString() === new Date(nowMs).toDateString()
    ? `at ${clock}`
    : `${WEEKDAYS[when.getDay()].toLowerCase()} ${clock}`;
}

// Reminders whose moment fell in (since, now]. Unlike a session, one slept through still
// fires: a forgotten two-minute job is exactly what this is for.
export function dueRemindersAt(reminders, since, now) {
  return reminders
    .filter((r) => !r.done && r.at !== null && r.at > since && r.at <= now)
    .sort((a, b) => a.at - b.at);
}

// Reminders that have come due and not been ticked off. They stay here however long it
// takes: a notification you missed is a thing forgotten again, which is the whole problem.
export function outstanding(reminders, now = Date.now()) {
  return reminders
    .filter((r) => !r.done && r.at !== null && r.at <= now)
    .sort((a, b) => a.at - b.at);
}

// How long until the next reminder is due, so it can fire on its minute rather than on whichever
// minute-tick happens to come after it. Null when nothing is waiting.
export function msUntilNext(reminders, now = Date.now()) {
  const next = reminders
    .filter((r) => !r.done && r.at !== null && r.at > now)
    .reduce((soonest, r) => Math.min(soonest, r.at), Infinity);
  return next === Infinity ? null : next - now;
}
