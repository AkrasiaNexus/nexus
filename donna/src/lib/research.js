import { ymd } from "./time.js";

const MAX_QUERIES = 6;
// What a portfolio is actually built from.
const KINDS = ["internship", "hackathon", "free online course", "summer program"];

// Subjects worth researching: things being worked toward, not errands.
const RESEARCHABLE = new Set(["skill", "idea", "explore"]);

// What she looks for is drawn from what you're already doing — your own subjects, not a
// generic list of opportunities that has nothing to do with you.
export function queriesFor(items, memories = []) {
  const subjects = items
    .filter((i) => i.status === "active" && RESEARCHABLE.has(i.category))
    .sort((a, b) => Number(Boolean(b.forProfile)) - Number(Boolean(a.forProfile)))
    .map((i) => i.title.toLowerCase());

  if (!subjects.length) return [];

  // A memory like "wants to study computer science in the US" is context for the search.
  const context = memories.map((m) => m.text).filter((t) => /stud(y|ying)|degree|university|college|major/i.test(t));

  const queries = [];
  for (const subject of subjects) {
    for (const kind of KINDS) {
      if (queries.length >= MAX_QUERIES) break;
      queries.push(`${subject} ${kind} for students application deadline`);
    }
  }
  for (const line of context.slice(0, 1)) {
    if (queries.length < MAX_QUERIES) queries.push(`${line} summer program application deadline`);
  }

  return queries.slice(0, MAX_QUERIES);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// A deadline is pulled out as a field here, once, rather than left in prose for the model
// to misread later. If it can't be read confidently it stays null — a wrong date on an
// application is worse than no date.
export function readDeadline(text = "") {
  const named = new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "i").exec(text);
  if (named) {
    const month = MONTHS.indexOf(named[1].toLowerCase());
    return ymd(new Date(Number(named[3]), month, Number(named[2])));
  }
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

const slug = (url) => String(url).replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();

export function normalise(result) {
  const title = String(result?.title ?? "").trim();
  const url = String(result?.url ?? "").trim();
  if (!title || !url) return null;

  return {
    id: slug(url),
    title,
    url,
    deadline: readDeadline(`${title} ${result.description ?? ""}`),
    note: String(result.description ?? "").trim().slice(0, 180),
    foundOn: ymd(new Date()),
  };
}

// Matched on the link, so the same programme written up differently is not "new" again.
export function unseen(found, seen) {
  const known = new Set(seen.map((f) => slug(f.url ?? f.id)));
  return found.filter((f) => !known.has(slug(f.url ?? f.id)));
}

// Closest deadline first, undated behind the dated, anything already closed dropped.
export function dueSoonest(findings, today = ymd(new Date())) {
  return findings
    .filter((f) => !f.deadline || f.deadline >= today)
    .sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
}
