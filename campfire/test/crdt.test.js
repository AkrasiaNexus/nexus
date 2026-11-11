import test from "node:test";
import assert from "node:assert/strict";
import { addEntry, emptyState, explore, merge, removeEntry, setNote, visibleEntries } from "../src/crdt.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random edits on a few replicas, with random partial syncs in between.
function simulate(seed, replicaCount = 4, steps = 60) {
  const rand = mulberry32(seed);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const names = Array.from({ length: replicaCount }, (_, i) => `r${i}`);
  const states = names.map(() => emptyState());
  const counters = names.map(() => 0);
  for (let s = 0; s < steps; s++) {
    const i = Math.floor(rand() * replicaCount);
    const ids = Object.keys(states[i].entries);
    const roll = rand();
    if (roll < 0.3 || !ids.length) {
      const id = `${names[i]}-${counters[i]++}`;
      states[i] = addEntry(states[i], names[i], id, { title: `T${id}`, meta: "m", created: s });
    } else if (roll < 0.6) {
      states[i] = setNote(states[i], names[i], pick(ids), `note ${seed}.${s}`);
    } else if (roll < 0.7) {
      states[i] = removeEntry(states[i], names[i], pick(ids));
    } else if (roll < 0.8) {
      states[i] = explore(states[i], `spot${Math.floor(rand() * 12)}`);
    } else {
      const j = Math.floor(rand() * replicaCount);
      states[i] = merge(states[i], states[j]);
    }
  }
  return { states, rand };
}

const SEEDS = 400;

test(`merge is commutative, associative and idempotent (${SEEDS} random cases)`, () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { states: [a, b, c] } = simulate(seed, 3);
    assert.deepEqual(merge(a, b), merge(b, a), `commutative, seed ${seed}`);
    assert.deepEqual(merge(merge(a, b), c), merge(a, merge(b, c)), `associative, seed ${seed}`);
    assert.deepEqual(merge(a, a), merge(a, emptyState()), `idempotent, seed ${seed}`);
  }
});

test(`every replica converges once everyone has synced, in any order (${SEEDS} random cases)`, () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { states, rand } = simulate(seed, 2 + (seed % 4));
    // Gossip in a random order until each replica has heard from every other (two passes is enough).
    const order = states.flatMap((_, i) => states.map((__, j) => [i, j])).sort(() => rand() - 0.5);
    let synced = [...states];
    for (let pass = 0; pass < 2; pass++) {
      for (const [i, j] of order) synced[i] = merge(synced[i], synced[j]);
    }
    for (const s of synced) assert.deepEqual(s, synced[0], `seed ${seed}`);
    assert.deepEqual(visibleEntries(synced[0]), visibleEntries(synced.at(-1)));
  }
});

test("no entry or explored place is ever lost by syncing", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { states } = simulate(seed, 3);
    const all = states.reduce(merge);
    for (const s of states) {
      for (const id of Object.keys(s.entries)) assert.ok(all.entries[id], `entry ${id} survives`);
      for (const p of s.explored) assert.ok(all.explored.includes(p), `place ${p} survives`);
    }
  }
});

test("concurrent note edits: the later write wins, ties go to the higher replica id", () => {
  let base = addEntry(emptyState(), "ali", "e1", { title: "Mina Draft", meta: "x", created: 1 });
  const ali = setNote(base, "ali", "e1", "we found a 2kg fish");
  const sara = setNote(setNote(base, "sara", "e1", "first try"), "sara", "e1", "sara's version");
  assert.equal(visibleEntries(merge(ali, sara))[0].note, "sara's version", "Sara wrote later (higher Lamport time)");

  const tieA = setNote(base, "ali", "e1", "ali");
  const tieB = setNote(base, "sara", "e1", "sara");
  assert.equal(visibleEntries(merge(tieA, tieB))[0].note, "sara");
  assert.equal(visibleEntries(merge(tieB, tieA))[0].note, "sara", "same answer from either side");
});

test("a delete hides the entry everywhere after syncing", () => {
  const base = addEntry(emptyState(), "ali", "e1", { title: "x", meta: "y", created: 1 });
  const deleted = removeEntry(base, "sara", "e1");
  assert.deepEqual(visibleEntries(merge(base, deleted)), []);
  assert.deepEqual(visibleEntries(merge(deleted, base)), []);
});

test("writes are immutable updates", () => {
  const before = emptyState();
  const after = addEntry(before, "ali", "e1", { title: "x", meta: "y", created: 1 });
  assert.deepEqual(before, emptyState());
  assert.notEqual(after, before);
  assert.equal(addEntry(after, "ali", "e1", { title: "changed", meta: "y", created: 2 }), after, "ids are write-once");
});
