// Verified against the live API on 21 Nov 2026: POST /v2/search returns
// { success, data: { web: [{ url, title, description, position }] } }.
const SEARCH_URL = "https://api.firecrawl.dev/v2/search";
const PER_QUERY = 5;

// No key, no research: she simply doesn't go looking, and says so rather than failing
// silently. Never in the repo — an env var at build time, or set once on this machine.
// Deliberately kept out of `donna_plan`, so it can never ride along into a model prompt.
const KEY_STORE = "donna_search_key";

export function apiKey() {
  const fromBuild = import.meta.env?.VITE_FIRECRAWL_KEY;
  if (fromBuild) return fromBuild;
  try {
    return localStorage.getItem(KEY_STORE) || null;
  } catch {
    return null;
  }
}

export class SearchUnavailable extends Error {}

export async function webSearch(query, { key = apiKey(), limit = PER_QUERY, signal } = {}) {
  if (!key) throw new SearchUnavailable("no search key set, so there's nothing to look with");

  let response;
  try {
    response = await fetch(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, limit, sources: ["web"] }),
      signal,
    });
  } catch (cause) {
    throw new SearchUnavailable("couldn't reach the search service", { cause });
  }

  if (response.status === 401 || response.status === 403) throw new SearchUnavailable("the search key was refused");
  if (!response.ok) throw new SearchUnavailable(`search returned ${response.status}`);

  const body = await response.json();
  return body?.data?.web ?? [];
}
