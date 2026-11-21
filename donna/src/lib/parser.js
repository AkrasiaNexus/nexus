import * as chrono from "chrono-node";
import { normalize } from "./idiolect.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

// chrono resolves these to the period's start, which for a deadline is already gone: it reads
// "today" as this moment and "this week" as Monday. They mean by the end of the period.
// shortcut: a time of day written alongside one of these is dropped ("gym today at 6pm" is
// due end of today); fold them into the chrono path if that ever matters.
const SPANS = [
  { regex: /\btoday\b/i, ms: 12 * HOUR },
  { regex: /\bthis\s+week\b/i, ms: WEEK },
  { regex: /\bthis\s+month\b/i, ms: MONTH },
];
const DEFAULT_TIMEFRAME = WEEK;

// chrono reads "2 w" and "2 weeks" but not "2 wks", which is how a week usually gets typed.
const WEEK_ABBR = /\b(\d+)\s*wks?\b/gi;

// A bare month or a short weekday is prose, not a deadline — "march madness", "sat nav fix",
// "sun screen". chrono reads one with no day of the month and no time, and nothing numeric was
// written. A duration like "3 months" knows only a month too, so the digit tells them apart.
// shortcut: a weekday someone did mean in three letters ("essay due fri") falls back to the
// default week, which beats a confident wrong date; drop the length test if that ever grates.
const isProse = (hit) =>
  !/\d/.test(hit.text) &&
  !hit.start.isCertain("day") &&
  !hit.start.isCertain("hour") &&
  (!hit.start.isCertain("weekday") || hit.text.length <= 3);

const CATEGORY_KEYWORDS = {
  skill: ["learn", "study", "practice", "course", "tutorial", "read about", "get into"],
  idea: ["idea", "startup", "build", "create", "make", "project", "app"],
  task: ["do", "fix", "finish", "complete", "submit", "send", "call", "email", "buy"],
  habit: ["gym", "workout", "meditate", "journal", "run", "sleep", "walk", "stretch", "diet"],
  explore: ["look into", "research", "explore", "check out", "investigate", "try"],
};
const DEFAULT_CATEGORY = "task";

const LEADING_FILLER = /^\s*(?:(?:low-key|honestly|basically|just|so)\s+)*(?:i\s+)?(?:(?:wanna|want\s+to|need\s+to|have\s+to|gotta|got\s+to|should|will)\s+)?/i;
const TRAILING_FILLER = /\s+(?:in|within|by|for|over|before|next|this|just)\s*$/i;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function extractTimeframe(raw, now) {
  for (const { regex, ms } of SPANS) {
    if (regex.test(raw)) return { timeframeMs: ms, remaining: raw.replace(regex, " ") };
  }

  const text = raw.replace(WEEK_ABBR, "$1 weeks");
  const [hit] = chrono.parse(text, new Date(now), { forwardDate: true });
  const timeframeMs = hit && !isProse(hit) ? hit.start.date().getTime() - now : 0;
  // A deadline already gone, or seconds away, would give a nudge ladder that fires all four at
  // once: fall back to the default rather than check in about it four times.
  if (timeframeMs < MINUTE) return { timeframeMs: DEFAULT_TIMEFRAME, remaining: raw };

  const before = text.slice(0, hit.index).replace(TRAILING_FILLER, "");
  return { timeframeMs, remaining: `${before} ${text.slice(hit.index + hit.text.length)}` };
}

export function detectCategory(text) {
  let best = { category: DEFAULT_CATEGORY, index: Infinity };
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const index = text.search(new RegExp(`\\b${escape(keyword)}\\b`, "i"));
      if (index !== -1 && index < best.index) best = { category, index };
    }
  }
  return best.category;
}

export function estimateEffort(timeframeMs) {
  if (timeframeMs <= HOUR) return "quick";
  if (timeframeMs <= 3 * DAY) return "short";
  if (timeframeMs <= 2 * WEEK) return "medium";
  return "long";
}

function toTitle(text) {
  let title = text.replace(/\s+/g, " ").trim().replace(/[,.;]+$/, "");
  title = title.replace(LEADING_FILLER, "");
  while (TRAILING_FILLER.test(title)) title = title.replace(TRAILING_FILLER, "");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// `profile` is an Idiolect profile (see idiolect.js); with one, slang is normalized before parsing.
export function parseBlurt(rawText, now = Date.now(), profile = null) {
  const text = profile ? normalize(rawText, profile).text : rawText;
  const { timeframeMs, remaining } = extractTimeframe(text, now);
  return {
    raw: rawText,
    title: toTitle(remaining) || toTitle(rawText),
    category: detectCategory(text),
    effort: estimateEffort(timeframeMs),
    deadline: new Date(now + timeframeMs).toISOString(),
    timeframeMs,
    createdAt: new Date(now).toISOString(),
  };
}

export function getNudgeSchedule(createdAt, deadline) {
  const start = new Date(createdAt).getTime();
  const span = new Date(deadline).getTime() - start;
  return [0.25, 0.5, 0.75, 1].map((pct) => ({
    at: new Date(start + span * pct).toISOString(),
    pct: Math.round(pct * 100),
    tone: pct < 0.5 ? "gentle" : pct < 1 ? "firm" : "urgent",
  }));
}
