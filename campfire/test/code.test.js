import test from "node:test";
import assert from "node:assert/strict";
import { addEntry, emptyState, explore, merge, setNote, visibleEntries } from "../src/crdt.js";
import { LIMITS, crc32, decode, encode, safeMerge, validate } from "../src/code.js";

function journal(n) {
  let s = emptyState();
  for (let i = 0; i < n; i++) {
    s = addEntry(s, "ali", `ali-${i}`, { title: `The Mina Draft #${i}`, meta: `Nov ${1 + (i % 28)} · 4 out · Mina`, created: 1_700_000_000_000 + i });
    s = setNote(s, "ali", `ali-${i}`, "Sara bought a cactus, Omar asked a fisherman about his strangest catch.");
    s = explore(s, `spot${i % 30}`);
  }
  return s;
}

test("round trip: what goes in comes out", async () => {
  const s = journal(5);
  assert.deepEqual(await decode(await encode(s)), s);
});

test("two phones sync by swapping codes", async () => {
  let ali = addEntry(emptyState(), "ali", "ali-0", { title: "Team War at Reem", meta: "Nov 10 · 4 out", created: 1 });
  let sara = explore(addEntry(emptyState(), "sara", "sara-0", { title: "The Mina Draft", meta: "Nov 11 · 3 out", created: 2 }), "mina");
  sara = merge(sara, await decode(await encode(ali)));
  ali = merge(ali, await decode(await encode(sara)));
  assert.deepEqual(ali, sara);
  assert.deepEqual(visibleEntries(ali).map((e) => e.title), ["The Mina Draft", "Team War at Reem"]);
});

test("a 100-entry journal fits in a chat message", async () => {
  const code = await encode(journal(100));
  assert.ok(code.length < 8000, `code is ${code.length} characters`);
});

test("damaged or cut-off codes are refused", async () => {
  const code = await encode(journal(3));
  const [p, body, sum] = code.split(".");
  await assert.rejects(decode("hello"), /isn't a Campfire sync code/);
  await assert.rejects(decode(`${p}.${body.slice(0, -10)}.${sum}`), /damaged or cut off/);
  const flipped = body.slice(0, 20) + (body[20] === "A" ? "B" : "A") + body.slice(21);
  await assert.rejects(decode(`${p}.${flipped}.${sum}`), /damaged/);
  await assert.rejects(decode(`${p}.${body}.00000000`), /checksum mismatch/);
});

test("zip bombs are stopped before they fill memory", async () => {
  const huge = new TextEncoder().encode(JSON.stringify({ v: 1, pad: "x".repeat(LIMITS.inflatedBytes * 2) }));
  const reader = new Blob([huge]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(reader).arrayBuffer());
  const body = Buffer.from(packed).toString("base64url");
  await assert.rejects(decode(`CF1.${body}.${crc32(huge)}`), /more data than a journal should hold/);
});

test("hostile or malformed states are rejected field by field", () => {
  const good = journal(1);
  const entry = good.entries["ali-0"];
  const bad = (patch) => () => validate({ ...good, ...patch });
  assert.throws(bad({ v: 2 }), /unknown version/);
  assert.throws(bad({ clock: -1 }), /bad clock/);
  assert.throws(bad({ explored: ["../etc"] }), /bad place id/);
  assert.throws(bad({ entries: JSON.parse('{"__proto__": {}}') }), /bad entry id/);
  assert.throws(bad({ entries: { x: { ...entry, data: { ...entry.data, title: "a".repeat(LIMITS.text + 1) } } } }), /bad title/);
  assert.throws(bad({ entries: { x: { ...entry, note: { v: 42, t: 1, r: "ali" } } } }), /bad note/);
  assert.throws(bad({ entries: { x: { ...entry, gone: { v: "yes", t: 1, r: "ali" } } } }), /bad delete flag/);
  assert.throws(bad({ entries: { x: { ...entry, data: { ...entry.data, author: "<script>" } } } }), /bad author/);
});

test("clocks and timestamps can't be pushed to the integer limit", () => {
  const good = journal(1);
  const entry = good.entries["ali-0"];
  assert.throws(() => validate({ ...good, clock: Number.MAX_SAFE_INTEGER }), /bad clock/);
  assert.throws(() => validate({ ...good, clock: LIMITS.clock + 1 }), /bad clock/);
  assert.throws(
    () => validate({ ...good, entries: { "ali-0": { ...entry, gone: { v: true, t: good.clock + 1, r: "zzz" } } } }),
    /from the future/,
    "a stamp newer than the code's own clock is forged",
  );
});

test("oversized pastes are refused before decoding", async () => {
  await assert.rejects(decode("CF1." + "A".repeat(LIMITS.codeChars) + ".00000000"), /too long/);
});

test("safeMerge refuses codes that rewrite entries you already have", () => {
  const mine = journal(2);
  const forged = structuredClone(mine);
  forged.entries["ali-0"].data.title = "Ali owes me 500 AED";
  assert.throws(() => safeMerge(mine, forged), /rewrite 1 entry you already have/);
});

test("safeMerge refuses merges that would push the journal past its limits", () => {
  const mine = journal(10);
  let junk = emptyState();
  for (let i = 0; i < LIMITS.entries - 5; i++) junk = addEntry(junk, "zz", `zz-${i}`, { title: "junk", meta: "junk", created: i });
  assert.throws(() => safeMerge(mine, junk), /too many entries/);
});

test("safeMerge returns a merged, valid journal for honest codes", () => {
  const ali = journal(3);
  const sara = addEntry(emptyState(), "sara", "sara-0", { title: "Team War at Reem", meta: "Nov 11", created: 9 });
  const merged = safeMerge(ali, sara);
  assert.deepEqual(merged, merge(ali, sara));
  assert.deepEqual(validate(merged), merged);
});

test("validation drops unknown fields instead of carrying them along", () => {
  const s = journal(1);
  const sneaky = { ...s, extra: "x", entries: { "ali-0": { ...s.entries["ali-0"], data: { ...s.entries["ali-0"].data, onclick: "x" } } } };
  const clean = validate(sneaky);
  assert.equal(clean.extra, undefined);
  assert.equal(clean.entries["ali-0"].data.onclick, undefined);
});
