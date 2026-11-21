// JavaScript port of Idiolect's normalizer (../../idiolect, Python reference).
// test/idiolect.test.js checks it against vectors exported from the Python version.
const WORD = /[\p{L}\p{M}\p{N}]/u;
const ROW = /^\|(.+)\|\s*$/;
const SEPARATOR = /^\|[\s:|-]+\|\s*$/;

export function parseProfile(markdown) {
  const replacements = new Map();
  let section = null;
  let header = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      section = line.slice(3).trim().toLowerCase();
      header = true;
      continue;
    }
    if (!["slang", "typos"].includes(section) || !ROW.test(line) || SEPARATOR.test(line)) continue;
    if (header) { header = false; continue; }
    const [written, standard] = line.slice(1, -1).split("|").map((c) => c.trim());
    if (written && standard) replacements.set(written.toLowerCase(), standard.toLowerCase());
  }
  return { replacements };
}

export function tokenSpans(text) {
  const chars = Array.from(text);
  const offsets = [];
  let pos = 0;
  for (const ch of chars) { offsets.push(pos); pos += ch.length; }
  offsets.push(pos);

  const spans = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (/\s/u.test(ch)) { i++; continue; }
    if (!WORD.test(ch)) { spans.push([ch.toLowerCase(), offsets[i], offsets[i + 1]]); i++; continue; }
    let j = i;
    while (j < chars.length && WORD.test(chars[j])) j++;
    if (j + 1 < chars.length && chars[j] === "'" && WORD.test(chars[j + 1])) {
      j++;
      while (j < chars.length && WORD.test(chars[j])) j++;
    }
    spans.push([text.slice(offsets[i], offsets[j]).toLowerCase(), offsets[i], offsets[j]]);
    i = j;
  }
  return spans;
}

export function normalize(text, profile) {
  let out = "";
  let last = 0;
  const changes = [];
  for (const [tok, start, end] of tokenSpans(text)) {
    const replacement = profile.replacements.get(tok);
    if (replacement === undefined || replacement === tok) continue;
    out += text.slice(last, start) + replacement;
    last = end;
    changes.push([tok, replacement]);
  }
  return { text: out + text.slice(last), changes };
}
