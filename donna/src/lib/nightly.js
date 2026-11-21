import { toMin } from "./time.js";

// Late evening rather than the small hours. A job scheduled for 3am on a laptop simply
// does not run: the machine is asleep. This hour is late enough that the day is done,
// early enough that the Mac is probably still awake.
export const RESEARCH_FROM = toMin("22:00");

// Runs once a day. If the machine slept through the window, the check still passes the
// next time it is awake — a missed night becomes a late morning, not a skipped day.
export function shouldResearch(plan, date, nowMinutes) {
  if (plan.researchedOn === date) return false;
  const sleptThroughIt = plan.researchedOn !== null && plan.researchedOn < date;
  return sleptThroughIt || nowMinutes >= RESEARCH_FROM;
}

import { queriesFor, normalise, unseen } from "./research.js";
import { webSearch, SearchUnavailable } from "./search.js";

// One night's work: look for what builds their profile, keep only what she hasn't already
// shown them. A search that fails is a quiet night, not a broken app — she'll go again
// tomorrow, and the morning brief still happens either way.
export async function researchOnce({ items, memories, findings, search = webSearch, signal }) {
  const queries = queriesFor(items, memories);
  if (!queries.length) return { found: [], reason: "nothing on your list worth researching yet" };

  const results = [];
  for (const query of queries) {
    try {
      results.push(...(await search(query, { signal })));
    } catch (e) {
      if (e instanceof SearchUnavailable) return { found: [], reason: e.message };
      throw e;
    }
  }

  const fresh = results.map(normalise).filter(Boolean);
  const byUrl = new Map(fresh.map((f) => [f.id, f]));
  return { found: unseen([...byUrl.values()], findings) };
}
