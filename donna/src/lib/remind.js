const MINUTE_MS = 60_000;

// "remind me to…", and the two other ways people actually ask.
const ASK = /^\s*(?:(?:can you|pls|please)\s+)?(?:remind me to|don'?t let me forget to|dont let me forget to|remember to)\s+/i;
const IN = /\bin\s+(\d+)\s*(min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i;
const MERIDIEM = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i;
const CLOCK = /\bat\s+(\d{1,2}):(\d{2})\b/;

const titled = (text) =>
  text.replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

// A two-minute job you'd otherwise forget. Deliberately not a calendar block: it takes no
// room in the week, it just arrives, gets done, and gets out of the way.
export function parseReminder(raw, nowMs = Date.now()) {
  if (!ASK.test(raw)) return null;

  let rest = raw.replace(ASK, "");
  let at = null;

  const relative = IN.exec(rest);
  const meridiem = MERIDIEM.exec(rest);
  const clock = CLOCK.exec(rest);

  if (relative) {
    const amount = Number(relative[1]);
    const minutes = /^h/i.test(relative[2]) ? amount * 60 : amount;
    at = nowMs + minutes * MINUTE_MS;
    rest = rest.replace(relative[0], " ");
  } else if (meridiem || clock) {
    const match = meridiem ?? clock;
    const hour24 = meridiem
      ? (Number(meridiem[1]) % 12) + (meridiem[3].toLowerCase() === "p" ? 12 : 0)
      : Number(clock[1]);
    const minute = Number((meridiem ? meridiem[2] : clock[2]) ?? 0);
    if (hour24 > 23 || minute > 59) return null;

    const when = new Date(nowMs);
    when.setHours(hour24, minute, 0, 0);
    if (when.getTime() <= nowMs) when.setDate(when.getDate() + 1);
    at = when.getTime();
    rest = rest.replace(match[0], " ");
  }

  const text = titled(rest);
  return text ? { text, at } : null;
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
