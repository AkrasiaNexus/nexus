import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseProfile, normalize, profileForPrompt } from "../src/lib/idiolect.js";
import { messagesForModel } from "../src/lib/planner.js";
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

test("the prompt profile keeps the prose a model needs and drops the tables the normalizer applies", () => {
  const markdown = [
    "# Baseline",
    "## Slang",
    "| written | standard |",
    "| --- | --- |",
    "| lowk | low-key |",
    "## Typos",
    "| written | standard |",
    "| --- | --- |",
    "| teh | the |",
    "## How to read me",
    "- I type fast and casual; infer meaning.",
    "## Intent cues",
    "| nah | rejecting your suggestion |",
  ].join("\n");

  const forPrompt = profileForPrompt(markdown);

  assert.doesNotMatch(forPrompt, /lowk/, "a substitution the normalizer already made");
  assert.doesNotMatch(forPrompt, /teh/, "likewise a typo row");
  assert.match(forPrompt, /I type fast and casual/, "prose only a model can use");
  assert.match(forPrompt, /rejecting your suggestion/, "intent cues are not mechanical substitutions");
});

test("the prompt profile is materially shorter than the file it comes from", () => {
  const markdown = fs.readFileSync(new URL("../src/lib/profile.md", import.meta.url), "utf8");

  const forPrompt = profileForPrompt(markdown);

  assert.ok(forPrompt.length < markdown.length * 0.6, `expected a real saving, got ${forPrompt.length} of ${markdown.length}`);
});

test("what reaches the model has the user's slang already expanded", () => {
  const profile = parseProfile(fs.readFileSync(new URL("../src/lib/profile.md", import.meta.url), "utf8"));
  const history = [
    { role: "user", content: "lowk wanna learn rust jus 2 wks" },
    { role: "assistant", content: "how many mins a day?" },
    { role: "error", content: "ollama isn't running" },
  ];

  const sent = messagesForModel(history, profile);

  assert.equal(sent.length, 2, "screen-only error lines never reach the model");
  assert.match(sent[0].content, /low-key want to learn/);
  assert.equal(sent[1].content, "how many mins a day?", "Donna's own words are left alone");
});
