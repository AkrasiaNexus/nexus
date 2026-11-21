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

// A bare month name is prose, not a deadline — "march madness", "august plans". chrono reads
// one as a month with no day, weekday or time, and nothing numeric was written. A written
// duration like "3 months" also knows only a month, so the digit is what tells them apart.
const isBareMonth = (hit) =>
  !/\d/.test(hit.text) && Object.keys(hit.start.knownValues).every((k) => k === "month" || k === "year");

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
  const timeframeMs = hit && !isBareMonth(hit) ? hit.start.date().getTime() - now : 0;
  // A deadline already gone, or seconds away, would give a nudge ladder that fires all four at
  // once: fall back to the default rather than check in about it four times.
  if (timeframeMs < MINUTE) return { timeframeMs: DEFAULT_TIMEFRAME, remaining: raw };

  return { timeframeMs, remaining: `${text.slice(0, hit.index)} ${text.slice(hit.index + hit.text.length)}` };
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
    title: toTitle(remaining),
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
