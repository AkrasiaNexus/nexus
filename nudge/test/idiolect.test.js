import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalize, parseProfile } from "../src/lib/idiolect.js";
import { parseBlurt } from "../src/lib/parser.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", "idiolect-conformance.json"), "utf8"));
const profile = parseProfile(fixture.profile);
const NOW = Date.UTC(2026, 10, 10, 9, 0, 0);

test(`matches the Python reference on all ${fixture.vectors.length} conformance vectors`, () => {
  for (const v of fixture.vectors) {
    const out = normalize(v.input, profile);
    assert.equal(out.text, v.normalized, JSON.stringify(v.input));
    assert.deepEqual(out.changes, v.changes, JSON.stringify(v.input));
  }
});

test("the bundled profile is the one the vectors were made from", () => {
  const bundled = fs.readFileSync(path.join(HERE, "..", "src", "lib", "profile.md"), "utf8");
  assert.equal(bundled.trim(), fixture.profile.trim());
});

test("slang-heavy blurts get clean titles once normalized", () => {
  const raw = "lowk wanna learn rust jus 2 wks";
  const plain = parseBlurt(raw, NOW);
  const fluent = parseBlurt(raw, NOW, profile);
  assert.equal(plain.title, "Lowk wanna learn rust jus", "without Idiolect the filler leaks into the title");
  assert.equal(fluent.title, "Learn rust");
  assert.equal(fluent.category, "skill");
  assert.equal(fluent.timeframeMs, 14 * 86_400_000);
  assert.equal(fluent.raw, raw, "the original words are kept");
});

test("gotta and smt are understood too", () => {
  const item = parseBlurt("gotta finish smt for the club by tomorrow", NOW, profile);
  assert.equal(item.title, "Finish something for the club");
  assert.equal(item.category, "task");
});
