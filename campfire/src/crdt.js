// A state-based CRDT for a small group's shared journal.
//
// Every replica (phone) holds the whole state. merge() is a join: commutative,
// associative and idempotent, so friends can swap state in any order, any
// number of times, and everyone ends up with the same journal.
//
//   entries  map id -> { data, note, gone }
//            data  immutable once written (title, meta, author, created)
//            note  last-writer-wins register
//            gone  last-writer-wins register (true = deleted)
//   explored grow-only set of place ids
//   clock    Lamport clock: a write is stamped clock+1; merge takes the max
//
// Last-writer-wins compares (time, replica, value) so ties never depend on
// which side of merge() a state is on.

export const VERSION = 1;

export function emptyState() {
  return { v: VERSION, clock: 0, entries: {}, explored: [] };
}

export function newReplicaId() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
}

function stamp(state, replica, value) {
  return { v: value, t: state.clock + 1, r: replica };
}

function laterOf(x, y) {
  if (x.t !== y.t) return x.t > y.t ? x : y;
  if (x.r !== y.r) return x.r > y.r ? x : y;
  return JSON.stringify(x.v) >= JSON.stringify(y.v) ? x : y;
}

function withEntry(state, id, entry, clock) {
  return { ...state, clock, entries: { ...state.entries, [id]: entry } };
}

export function addEntry(state, replica, id, data) {
  if (Object.hasOwn(state.entries, id)) return state;
  const entry = { data: { ...data, author: replica }, note: stamp(state, replica, ""), gone: stamp(state, replica, false) };
  return withEntry(state, id, entry, state.clock + 1);
}

export function setNote(state, replica, id, text) {
  if (!Object.hasOwn(state.entries, id)) return state;
  const entry = state.entries[id];
  return withEntry(state, id, { ...entry, note: stamp(state, replica, text) }, state.clock + 1);
}

export function removeEntry(state, replica, id) {
  if (!Object.hasOwn(state.entries, id)) return state;
  const entry = state.entries[id];
  return withEntry(state, id, { ...entry, gone: stamp(state, replica, true) }, state.clock + 1);
}

export function explore(state, placeId) {
  if (state.explored.includes(placeId)) return state;
  return { ...state, explored: [...state.explored, placeId].sort() };
}

export function merge(a, b) {
  const entries = { ...a.entries };
  for (const [id, theirs] of Object.entries(b.entries)) {
    // hasOwn, not entries[id]: an id like "constructor" would otherwise find Object's own.
    if (!Object.hasOwn(entries, id)) {
      entries[id] = theirs;
      continue;
    }
    const mine = entries[id];
    // Data never changes after creation; pick deterministically if two replicas disagree.
    const data = JSON.stringify(mine.data) <= JSON.stringify(theirs.data) ? mine.data : theirs.data;
    entries[id] = { data, note: laterOf(mine.note, theirs.note), gone: laterOf(mine.gone, theirs.gone) };
  }
  const sorted = Object.fromEntries(Object.keys(entries).sort().map((id) => [id, entries[id]]));
  return {
    v: VERSION,
    clock: Math.max(a.clock, b.clock),
    entries: sorted,
    explored: [...new Set([...a.explored, ...b.explored])].sort(),
  };
}

/** What the app shows: live entries, newest first. */
export function visibleEntries(state) {
  return Object.entries(state.entries)
    .filter(([, e]) => !e.gone.v)
    .map(([id, e]) => ({ id, ...e.data, note: e.note.v }))
    .sort((x, y) => (y.created ?? 0) - (x.created ?? 0) || (x.id < y.id ? -1 : 1));
}
