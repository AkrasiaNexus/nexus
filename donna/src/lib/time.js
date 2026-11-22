// Local time throughout: dates are YYYY-MM-DD, clock times are HH:MM, durations are minutes.

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");

export const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function parseYmd(text) {
  const [y, m, d] = String(text).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(text, days) {
  const date = parseYmd(text);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

export function toMin(clock) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(clock).trim());
  if (!match || +match[1] > 24 || +match[2] > 59) throw new Error(`time must be HH:MM, got "${clock}"`);
  return +match[1] * 60 + +match[2];
}

export const fromMin = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// Round-trips so a date that doesn't exist (Feb 31 rolls over to Mar 3) is refused.
export const isYmd = (text) => /^\d{4}-\d{2}-\d{2}$/.test(String(text)) && ymd(parseYmd(text)) === text;

export const today = () => ymd(new Date());

export function nowMin() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// The Monday-first week containing `date`, as seven YYYY-MM-DD strings.
export function weekOf(date) {
  const shift = (parseYmd(date).getDay() + 6) % 7;
  const monday = addDays(date, -shift);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// How a clock time is shown and said: the 12-hour way with am or pm, and no ":00" on the hour —
// "7pm", "9:30am". Storage stays HH:MM, which the scheduling and the model's tools rely on.
export function clock12(hhmm) {
  const minutes = toMin(hhmm);
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour < 12 ? "am" : "pm";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return minute ? `${shown}:${pad(minute)}${suffix}` : `${shown}${suffix}`;
}
