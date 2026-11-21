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
