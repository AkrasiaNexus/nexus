import { normalize } from "./idiolect.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

// Units must be whole words so "3 more eggs" and "2 drones" are not timeframes.
const TIMEFRAMES = [
  { regex: /\b(\d+)\s*(?:mins?|minutes?)\b/i, ms: MINUTE },
  { regex: /\b(\d+)\s*(?:h|hrs?|hours?)\b/i, ms: HOUR },
  { regex: /\b(\d+)\s*(?:d|days?)\b/i, ms: DAY },
  { regex: /\b(\d+)\s*(?:w|wks?|weeks?)\b/i, ms: WEEK },
  { regex: /\b(\d+)\s*(?:mo|mos|months?)\b/i, ms: MONTH },
  { regex: /\btoday\b/i, ms: 12 * HOUR },
  { regex: /\btomorrow\b/i, ms: DAY },
  { regex: /\bthis\s+week\b/i, ms: WEEK },
  { regex: /\bnext\s+week\b/i, ms: 2 * WEEK },
  { regex: /\bthis\s+month\b/i, ms: MONTH },
  { regex: /\bnext\s+month\b/i, ms: 2 * MONTH },
];
const DEFAULT_TIMEFRAME = WEEK;

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

function extractTimeframe(text) {
  for (const { regex, ms } of TIMEFRAMES) {
    const match = text.match(regex);
    if (match) {
      const amount = match[1] ? parseInt(match[1], 10) : 1;
      return { timeframeMs: amount * ms, remaining: text.replace(regex, " ") };
    }
  }
  return { timeframeMs: DEFAULT_TIMEFRAME, remaining: text };
}

function detectCategory(text) {
  let best = { category: DEFAULT_CATEGORY, index: Infinity };
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const index = text.search(new RegExp(`\\b${escape(keyword)}\\b`, "i"));
      if (index !== -1 && index < best.index) best = { category, index };
    }
  }
  return best.category;
}

function estimateEffort(timeframeMs) {
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
  const { timeframeMs, remaining } = extractTimeframe(text);
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
