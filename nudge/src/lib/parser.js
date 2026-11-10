const TIMEFRAME_PATTERNS = [
  { regex: /(\d+)\s*min(ute)?s?/i, unit: "minutes" },
  { regex: /(\d+)\s*h(ou)?rs?/i, unit: "hours" },
  { regex: /(\d+)\s*d(ays?)?/i, unit: "days" },
  { regex: /(\d+)\s*w(eeks?)?/i, unit: "weeks" },
  { regex: /(\d+)\s*m(onths?)?/i, unit: "months" },
  { regex: /today/i, unit: "days", fixed: 0 },
  { regex: /tomorrow/i, unit: "days", fixed: 1 },
  { regex: /this\s*week/i, unit: "weeks", fixed: 1 },
  { regex: /next\s*week/i, unit: "weeks", fixed: 2 },
  { regex: /this\s*month/i, unit: "months", fixed: 1 },
];

const CATEGORY_KEYWORDS = {
  skill: ["learn", "study", "practice", "course", "tutorial", "read about", "get into"],
  idea: ["idea", "startup", "build", "create", "make", "project", "app"],
  task: ["do", "fix", "finish", "complete", "submit", "send", "call", "email", "buy"],
  habit: ["gym", "workout", "meditate", "journal", "run", "sleep", "walk", "stretch", "diet"],
  explore: ["look into", "research", "explore", "check out", "investigate", "try"],
};

const UNIT_TO_MS = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
  months: 2_592_000_000,
};

function extractTimeframe(text) {
  for (const { regex, unit, fixed } of TIMEFRAME_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      const amount = fixed !== undefined ? fixed : parseInt(match[1], 10);
      const ms = amount * UNIT_TO_MS[unit];
      const deadline = new Date(Date.now() + ms);
      const cleaned = text.replace(regex, "").trim().replace(/,\s*$/, "");
      return { deadline, timeframeMs: ms, remaining: cleaned };
    }
  }
  // default: 1 week
  return {
    deadline: new Date(Date.now() + UNIT_TO_MS.weeks),
    timeframeMs: UNIT_TO_MS.weeks,
    remaining: text,
  };
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "task";
}

function estimateEffort(timeframeMs) {
  if (timeframeMs <= UNIT_TO_MS.hours) return "quick";
  if (timeframeMs <= UNIT_TO_MS.days * 3) return "short";
  if (timeframeMs <= UNIT_TO_MS.weeks * 2) return "medium";
  return "long";
}

export function parseBlurt(rawText) {
  const { deadline, timeframeMs, remaining } = extractTimeframe(rawText);
  const category = detectCategory(rawText);
  const effort = estimateEffort(timeframeMs);
  const title = remaining.replace(/^\s*(i\s+)?(wanna|want\s+to|need\s+to|gotta|should)\s+/i, "").trim();

  return {
    raw: rawText,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    category,
    effort,
    deadline: deadline.toISOString(),
    timeframeMs,
    createdAt: new Date().toISOString(),
  };
}

export function getNudgeSchedule(createdAt, deadline) {
  const start = new Date(createdAt).getTime();
  const end = new Date(deadline).getTime();
  const span = end - start;

  return [0.25, 0.5, 0.75, 1.0].map((pct) => ({
    at: new Date(start + span * pct).toISOString(),
    pct: Math.round(pct * 100),
    tone: pct < 0.5 ? "gentle" : pct < 1 ? "firm" : "urgent",
  }));
}
