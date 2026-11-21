import test from "node:test";
import assert from "node:assert/strict";
import { createTools, runTurn, systemPrompt } from "../src/lib/planner.js";

const TODAY = "2026-11-24";

function stubReplies(...replies) {
  const original = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    const next = replies.shift() ?? { message: { content: "ok" } };
    return { ok: true, status: 200, json: async () => next };
  };
  return { sent, restore: () => { globalThis.fetch = original; } };
}

const toolCall = (name, args) => ({ message: { content: "", tool_calls: [{ function: { name, arguments: args } }] } });
const says = (content) => ({ message: { content } });

function tools({ items = [], blocks = [], fixed = [] } = {}) {
  const booked = [];
  const api = createTools({
    plan: () => ({ blocks, fixed }),
    items: () => items,
    onSchedule: (b) => { booked.push(b); return { id: "new" }; },
    onAddGoal: () => ({ id: "g1" }),
    onRemoveGoal: () => "ok",
    onSetFixed: () => ({ id: "f1" }),
    onMoveBlock: () => "ok",
    onRemoveBlock: () => "ok",
  });
  return { api, booked };
}

const dueItem = { id: "i1", title: "Physics pset", status: "active", deadline: `${TODAY}T18:00:00.000Z` };

test("a reply with no tool calls comes straight back", async () => {
  const { restore } = stubReplies(says("alr, nothing booked."));
  const { api } = tools();

  const { text, changes } = await runTurn([{ role: "user", content: "yo" }], api);

  assert.equal(text, "alr, nothing booked.");
  assert.deepEqual(changes, []);
  restore();
});

test("a tool call runs, and its result is fed back for the next round", async () => {
  const { sent, restore } = stubReplies(
    toolCall("schedule_block", { title: "Rust", date: TODAY, start: "19:00", minutes: 60 }),
    says("booked rust at 7."),
  );
  const { api, booked } = tools();

  const { text, changes } = await runTurn([{ role: "user", content: "book rust 7pm" }], api);

  assert.equal(booked.length, 1, "the session was actually booked");
  assert.deepEqual(changes, ["schedule_block"]);
  assert.equal(text, "booked rust at 7.");
  assert.equal(sent[1].messages.at(-1).role, "tool", "the tool result went back to the model");
  restore();
});

test("booking over something already due is blocked and comes back as a question", async () => {
  const { restore } = stubReplies(
    toolCall("schedule_block", { title: "Lore spots", date: TODAY, start: "19:00", minutes: 60 }),
    says("physics pset is due today. still want this booked?"),
  );
  const { api, booked } = tools({ items: [dueItem] });

  const { changes } = await runTurn([{ role: "user", content: "book lore spots 7pm" }], api);

  assert.equal(booked.length, 0, "nothing was booked without a yes");
  assert.deepEqual(changes, [], "a blocked call is not counted as a change");
  restore();
});

test("once confirmed, the same booking goes through", async () => {
  const { restore } = stubReplies(
    toolCall("schedule_block", { title: "Lore spots", date: TODAY, start: "19:00", minutes: 60, confirmed: true }),
    says("done, booked for 7."),
  );
  const { api, booked } = tools({ items: [dueItem] });

  await runTurn([{ role: "user", content: "yeah do it anyway" }], api);

  assert.equal(booked.length, 1);
  restore();
});

test("a tool that throws is reported to the model instead of killing the turn", async () => {
  const { restore } = stubReplies(toolCall("schedule_block", { title: "x", date: TODAY, start: "nonsense", minutes: 60 }), says("that time didn't work."));
  const api = createTools({
    plan: () => ({ blocks: [], fixed: [] }),
    items: () => [],
    onSchedule: () => { throw new Error("time must be HH:MM"); },
    onAddGoal: () => ({}), onRemoveGoal: () => "ok", onSetFixed: () => ({}), onMoveBlock: () => "ok", onRemoveBlock: () => "ok",
  });

  const { text, changes } = await runTurn([{ role: "user", content: "book x" }], api);

  assert.deepEqual(changes, []);
  assert.equal(text, "that time didn't work.");
  restore();
});

test("an unknown tool name does not crash the turn", async () => {
  const { restore } = stubReplies(toolCall("summon_demon", {}), says("cant do that."));
  const { api } = tools();

  const { text } = await runTurn([{ role: "user", content: "hi" }], api);

  assert.equal(text, "cant do that.");
  restore();
});

test("a model stuck calling tools forever is cut off and made to answer", async () => {
  const loop = Array.from({ length: 6 }, () => toolCall("find_free_slots", { from_date: TODAY, minutes: 30 }));
  const { sent, restore } = stubReplies(...loop, says("here's what's free."));
  const { api } = tools();

  const { text } = await runTurn([{ role: "user", content: "when am i free" }], api);

  assert.equal(sent.length, 7, "six tool rounds, then one forced answer");
  assert.deepEqual(sent[6].tools, [], "the forced answer offers no tools to call");
  assert.equal(text, "here's what's free.");
  restore();
});

test("a model that returns nothing still says something rather than going silent", async () => {
  const { restore } = stubReplies(says(""));
  const { api } = tools();

  const { text } = await runTurn([{ role: "user", content: "yo" }], api);

  assert.match(text, /say that again/);
  restore();
});

test("the system prompt carries the profile and the current plan", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [] }, items: [dueItem], profile: "they write lowercase" });

  assert.match(prompt, /they write lowercase/);
  assert.match(prompt, /Physics pset/);
  assert.match(prompt, /ask them to confirm/);
});

test("tools are sent to the model without their run functions", async () => {
  const { sent, restore } = stubReplies(says("hi"));
  const { api } = tools();

  await runTurn([{ role: "user", content: "yo" }], api);

  assert.ok(sent[0].tools.every((t) => t.run === undefined), "run closures must not be serialised");
  assert.ok(sent[0].tools.some((t) => t.function.name === "schedule_block"));
  restore();
});
