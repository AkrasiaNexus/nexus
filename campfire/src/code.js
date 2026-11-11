// Sync codes: the whole state as text you can paste into any chat.
//
//   CF1.<base64url(deflate(json))>.<crc32 hex>
//
// A pasted code is untrusted input, so decode() checks the checksum, caps the
// inflated size (zip bombs), and validates every field before anything merges.
import { VERSION } from "./crdt.js";

const PREFIX = "CF1";
export const LIMITS = { entries: 500, explored: 500, text: 280, note: 1000, inflatedBytes: 512 * 1024 };
const ID = /^[A-Za-z0-9-]{1,48}$/;
const REPLICA = /^[a-z0-9]{1,16}$/;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

async function pipe(bytes, stream, limit = Infinity) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Sync code expands to more data than a journal should hold");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

export async function encode(state) {
  const json = new TextEncoder().encode(JSON.stringify(state));
  const packed = await pipe(json, new CompressionStream("deflate-raw"));
  return `${PREFIX}.${toBase64Url(packed)}.${crc32(json)}`;
}

export async function decode(code) {
  const parts = String(code).trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) throw new Error("That isn't a Campfire sync code");
  let packed;
  try {
    packed = fromBase64Url(parts[1]);
  } catch {
    throw new Error("Sync code is damaged (bad characters)");
  }
  let json;
  try {
    json = await pipe(packed, new DecompressionStream("deflate-raw"), LIMITS.inflatedBytes);
  } catch (err) {
    if (err.message.startsWith("Sync code expands")) throw err;
    throw new Error("Sync code is damaged or cut off");
  }
  if (crc32(json) !== parts[2]) throw new Error("Sync code is damaged or cut off (checksum mismatch)");
  return validate(JSON.parse(new TextDecoder().decode(json)));
}

const isStamp = (s, check) =>
  s && typeof s === "object" && Number.isSafeInteger(s.t) && s.t >= 0 && REPLICA.test(s.r) && check(s.v);

function fail(why) {
  throw new Error(`Sync code rejected: ${why}`);
}

export function validate(state) {
  if (!state || typeof state !== "object" || state.v !== VERSION) fail("unknown version");
  if (!Number.isSafeInteger(state.clock) || state.clock < 0) fail("bad clock");
  if (!Array.isArray(state.explored) || state.explored.length > LIMITS.explored) fail("bad explored list");
  if (!state.explored.every((p) => typeof p === "string" && ID.test(p))) fail("bad place id");
  if (!state.entries || typeof state.entries !== "object" || Array.isArray(state.entries)) fail("bad entries");
  const ids = Object.keys(state.entries);
  if (ids.length > LIMITS.entries) fail("too many entries");

  const entries = {};
  for (const id of ids) {
    if (!ID.test(id)) fail(`bad entry id "${id.slice(0, 20)}"`);
    const e = state.entries[id];
    const d = e?.data;
    if (!d || typeof d !== "object") fail("entry without data");
    for (const key of ["title", "meta"]) {
      if (typeof d[key] !== "string" || d[key].length > LIMITS.text) fail(`bad ${key}`);
    }
    if (!REPLICA.test(d.author)) fail("bad author");
    if (!Number.isSafeInteger(d.created) || d.created < 0) fail("bad created time");
    if (!isStamp(e.note, (v) => typeof v === "string" && v.length <= LIMITS.note)) fail("bad note");
    if (!isStamp(e.gone, (v) => typeof v === "boolean")) fail("bad delete flag");
    entries[id] = {
      data: { title: d.title, meta: d.meta, author: d.author, created: d.created },
      note: { v: e.note.v, t: e.note.t, r: e.note.r },
      gone: { v: e.gone.v, t: e.gone.t, r: e.gone.r },
    };
  }
  // Rebuilt from checked fields only, so nothing unexpected rides along.
  return { v: VERSION, clock: state.clock, entries, explored: [...state.explored] };
}
