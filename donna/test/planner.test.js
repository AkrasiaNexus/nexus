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

const dueItem = { id: "i1", title: "Physics pset", status: "active", deadline: `${TODAY}T18:00:00` };

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

test("the prompt separates one-off sessions and weekly commitments from goals before asking goal questions", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [] }, items: [], profile: "" });

  const oneOff = prompt.indexOf("schedule_block");
  const goalRule = prompt.indexOf("Only for a goal");  // stable anchor: survives rewording the questions
  assert.ok(oneOff > -1 && oneOff < goalRule, "the one-off rule must come before the goal rule");
  assert.match(prompt, /set_fixed/);
  assert.match(prompt, /only (for )?a goal/i, "the goal questions must not apply to everything");
});

test("the prompt gives the current local clock time, so 'in 5 mins' can be booked", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [] }, items: [], profile: "" });
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  assert.ok(prompt.includes(clock), `expected ${clock} in the prompt`);
});

test("deadlines reach the model as local wall-clock times, not UTC ISO strings", () => {
  const due = new Date(2026, 10, 24, 23, 0);
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [] }, items: [{ ...dueItem, deadline: due.toISOString() }], profile: "" });

  assert.ok(prompt.includes("2026-11-24 23:00"), "the model read 19:00Z as 'due at 7pm'");
  assert.ok(!prompt.includes(due.toISOString()));
});

test("a blocked booking is answered with the guard's own words, so the model cannot claim it booked", async () => {
  const { sent, restore } = stubReplies(
    toolCall("schedule_block", { title: "Valorant", date: TODAY, start: "16:02", minutes: 60 }),
    says("you got it, i put valorant in for 4:02 pm."),
  );
  const { api, booked } = tools({ items: [dueItem] });

  const { text, changes } = await runTurn([{ role: "user", content: "valorant in 5" }], api);

  assert.equal(booked.length, 0);
  assert.deepEqual(changes, []);
  assert.match(text, /Physics pset is due today.*still want this booked\?/);
  assert.equal(sent.length, 1, "no second round for the model to spin the refusal");
  restore();
});

const run = (api, name, args) => api.find((t) => t.function.name === name).run(args);

test("a booking with a malformed date, time or length is rejected before it reaches the plan", () => {
  const { api, booked } = tools();

  for (const bad of [
    { title: "Rust", date: "tomorrow", start: "19:00", minutes: 60 },
    { title: "Rust", date: TODAY, start: "7pm", minutes: 60 },
    { title: "Rust", date: TODAY, start: "19:00", minutes: -30 },
    { title: "Rust", date: TODAY, start: "19:00", minutes: "an hour" },
    { title: "", date: TODAY, start: "19:00", minutes: 60 },
  ]) {
    assert.throws(() => run(api, "schedule_block", bad), undefined, JSON.stringify(bad));
  }
  assert.equal(booked.length, 0);
});

test("a goal needs a real due date and a sane number of minutes a day", () => {
  const { api } = tools();

  assert.throws(() => run(api, "add_goal", { title: "Rust", due: "in 2 weeks", minutes_per_day: 30 }));
  assert.throws(() => run(api, "add_goal", { title: "Rust", due: "2026-12-05", minutes_per_day: 0 }));
  assert.equal(run(api, "add_goal", { title: "Rust", due: "2026-12-05", minutes_per_day: 30 }).id, "g1");
});

test("a weekly commitment needs weekdays 0-6 and an end after its start", () => {
  const { api } = tools();

  assert.throws(() => run(api, "set_fixed", { title: "Gym", days: [1, 9], start: "06:00", end: "07:00" }));
  assert.throws(() => run(api, "set_fixed", { title: "Gym", days: [1], start: "07:00", end: "06:00" }));
  assert.deepEqual(run(api, "set_fixed", { title: "Gym", days: [1, 3, 5], start: "06:00", end: "07:00" }), { id: "f1" });
});

test("moving a session checks the new date and time too", () => {
  const { api } = tools({ blocks: [{ id: "b1", title: "Rust", date: TODAY, start: "18:00", minutes: 60 }] });

  assert.throws(() => run(api, "move_block", { id: "b1", date: "monday", start: "19:00" }));
  assert.throws(() => run(api, "move_block", { id: "nope", date: TODAY, start: "19:00" }));
  assert.equal(run(api, "move_block", { id: "b1", date: TODAY, start: "19:00" }), "ok");
});

test("a free-slot search with a malformed date is rejected rather than searching garbage", () => {
  const { api } = tools();

  assert.throws(() => run(api, "find_free_slots", { from_date: "today", minutes: 30 }));
  assert.ok(Array.isArray(run(api, "find_free_slots", { from_date: TODAY, minutes: 30 })));
});

test("removing a goal or session needs an id that exists, so a null id cannot wipe every one-off", () => {
  const { api } = tools({ items: [dueItem], blocks: [{ id: "b1", itemId: null, title: "Gym", date: TODAY, start: "18:00", minutes: 60 }] });

  for (const id of [null, undefined, "", "ghost"]) {
    assert.throws(() => run(api, "remove_goal", { id }), undefined, `remove_goal ${id}`);
    assert.throws(() => run(api, "remove_block", { id }), undefined, `remove_block ${id}`);
  }
  assert.equal(run(api, "remove_goal", { id: "i1" }), "ok");
  assert.equal(run(api, "remove_block", { id: "b1" }), "ok");
});

test("a free-slot search cannot be asked to loop forever or look for an impossible length", () => {
  const { api } = tools();

  assert.throws(() => run(api, "find_free_slots", { from_date: TODAY, minutes: 30, days: 1e9 }));
  assert.throws(() => run(api, "find_free_slots", { from_date: TODAY, minutes: 30, days: Infinity }));
  assert.throws(() => run(api, "find_free_slots", { from_date: TODAY, minutes: 1000 }), undefined, "longer than the whole day window");
});

test("a weekly commitment is stored with only its own fields and a fresh id", () => {
  let saved;
  const api = createTools({ plan: () => ({ blocks: [], fixed: [] }), items: () => [], onSetFixed: (e) => { saved = e; return e; } });

  run(api, "set_fixed", { title: "Gym", days: [1], start: "06:00", end: "07:00", id: "existing", extra: "junk" });

  assert.deepEqual(saved, { title: "Gym", days: [1], start: "06:00", end: "07:00" });
});

test("priority, goal_id and title length are checked too", () => {
  const { api, booked } = tools({ items: [{ ...dueItem, deadline: "2099-01-01T12:00:00" }] });

  assert.throws(() => run(api, "add_goal", { title: "Rust", due: "2026-12-05", minutes_per_day: 30, priority: "urgent!!" }));
  assert.throws(() => run(api, "add_goal", { title: "x".repeat(201), due: "2026-12-05", minutes_per_day: 30 }));
  assert.throws(() => run(api, "schedule_block", { title: "Rust", date: TODAY, start: "19:00", minutes: 60, goal_id: "ghost" }));
  run(api, "schedule_block", { title: "Rust", date: TODAY, start: "19:00", minutes: 60, goal_id: "i1" });
  assert.equal(booked.length, 1);
});

test("a goal's own session on its due day is not blocked by that same goal", () => {
  const { api, booked } = tools({ items: [dueItem] });

  run(api, "schedule_block", { title: "Physics", date: TODAY, start: "19:00", minutes: 60, goal_id: "i1" });

  assert.equal(booked.length, 1);
});

test("when a booking is blocked, what did go through in the same round is still said", async () => {
  const { restore } = stubReplies({ message: { content: "", tool_calls: [
    { function: { name: "add_goal", arguments: { title: "Rust", due: "2026-12-05", minutes_per_day: 30 } } },
    { function: { name: "schedule_block", arguments: { title: "Rust", date: TODAY, start: "19:00", minutes: 30 } } },
  ] } });
  const { api } = tools({ items: [dueItem] });

  const { text, changes } = await runTurn([{ role: "user", content: "rust 30 a day" }], api);

  assert.deepEqual(changes, ["add_goal"]);
  assert.match(text, /added the goal/);
  assert.match(text, /still want this booked\?/);
  restore();
});

test("only active goals reach the prompt, and a corrupt deadline does not print NaN", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [] }, profile: "", items: [
    { ...dueItem, id: "done1", title: "Old essay", status: "done" },
    { ...dueItem, id: "bad", title: "Broken", deadline: undefined },
  ] });

  assert.ok(!prompt.includes("Old essay"));
  assert.ok(!prompt.includes("NaN"));
});

test("adding a goal books its daily sessions in the same call and says when", async () => {
  const { today: todayYmd, addDays: plusDays } = await import("../src/lib/time.js");
  const { api, booked } = tools();
  const due = plusDays(todayYmd(), 2);

  const result = run(api, "add_goal", { title: "Rust", due, minutes_per_day: 30 });

  assert.equal(result.id, "g1");
  assert.ok(booked.length >= 2, "tomorrow and the day after at least");
  assert.ok(booked.every((b) => b.goal_id === "g1" && b.minutes === 30 && b.title === "Rust"));
  assert.deepEqual(result.booked, booked.map(({ date, start }) => `${date} ${start}`));
});

test("the prompt tells the model add_goal books the sessions, so it does not promise and forget", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [] }, items: [], profile: "" });

  assert.match(prompt, /add_goal books (its|the) daily sessions/);
});

test("the prompt says a stated duration is the deadline, so 'for 2 weeks' is not asked again", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [] }, items: [], profile: "" });

  assert.match(prompt, /"for 2 weeks".*deadline/);
});

test("add_goal never throws after the goal is saved, so the model cannot retry it into a duplicate", async () => {
  const { today: todayYmd, addDays: plusDays } = await import("../src/lib/time.js");
  let calls = 0;
  const api = createTools({
    plan: () => ({ blocks: [], fixed: [] }), items: () => [],
    onAddGoal: () => ({ id: "g1" }),
    onSchedule: () => { if (++calls === 2) throw new Error("clashes with Gym at 07:00"); return {}; },
  });

  const result = run(api, "add_goal", { title: "Rust", due: plusDays(todayYmd(), 3), minutes_per_day: 30 });

  assert.equal(result.id, "g1");
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0], /clashes/);
});

test("auto-booked goal sessions leave a day alone when something else is due that day", async () => {
  const { today: todayYmd, addDays: plusDays } = await import("../src/lib/time.js");
  const tomorrow = plusDays(todayYmd(), 1);
  const { api, booked } = tools({ items: [{ ...dueItem, deadline: `${tomorrow}T18:00:00` }] });

  const result = run(api, "add_goal", { title: "Rust", due: plusDays(todayYmd(), 3), minutes_per_day: 30 });

  assert.ok(!booked.some((b) => b.date === tomorrow), "tomorrow is for the physics pset");
  assert.ok(result.skipped.some((s) => s.startsWith(tomorrow)));
});

test("a goal due in the past is refused, and one where nothing fits says so", async () => {
  const { today: todayYmd, addDays: plusDays } = await import("../src/lib/time.js");
  const full = { blocks: [], fixed: [{ id: "f", title: "Busy", days: [0, 1, 2, 3, 4, 5, 6], start: "07:00", end: "23:00" }] };
  const api = createTools({ plan: () => full, items: () => [], onAddGoal: () => ({ id: "g1" }), onSchedule: () => ({}) });

  assert.throws(() => run(api, "add_goal", { title: "Rust", due: plusDays(todayYmd(), -1), minutes_per_day: 30 }));
  const result = run(api, "add_goal", { title: "Rust", due: plusDays(todayYmd(), 2), minutes_per_day: 30 });
  assert.deepEqual(result.booked, []);
  assert.match(result.note, /nothing fit/);
});

test("a goal longer than the booking horizon says the rest is not booked yet", async () => {
  const { today: todayYmd, addDays: plusDays } = await import("../src/lib/time.js");
  const { api } = tools();

  const result = run(api, "add_goal", { title: "Rust", due: plusDays(todayYmd(), 40), minutes_per_day: 30 });

  assert.match(result.note, /first 14 days/);
});

test("booking over a session is refused with what it would cost, not silently replaced", async () => {
  const rust = { id: "g1", title: "Learn Rust", status: "active", deadline: `${TODAY}T23:00:00` };
  const session = { id: "b1", itemId: "g1", title: "Rust", date: TODAY, start: "19:00", minutes: 60, done: false };
  const { restore } = stubReplies(
    toolCall("schedule_block", { title: "Valorant", date: TODAY, start: "19:00", minutes: 60, confirmed: true }),
    says("fine, swapped."),
  );
  const { api, booked } = tools({ items: [rust], blocks: [session] });

  const blockedRun = api.find((t) => t.function.name === "schedule_block").run;
  const refusal = blockedRun({ title: "Valorant", date: TODAY, start: "19:00", minutes: 60 });

  assert.equal(refusal.blocked, true);
  assert.match(refusal.ask, /learn rust/i, "it names what gets displaced");
  assert.equal(booked.length, 0);

  await runTurn([{ role: "user", content: "valorant at 7, yes im sure" }], api);
  assert.equal(booked.length, 1, "confirmed goes through");
  restore();
});

test("the prompt makes Donna ask how much a goal matters rather than guess it", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [] }, items: [], profile: "" });

  assert.match(prompt, /how much it matters/i);
  assert.match(prompt, /how badly they want it|could wait/i);
  assert.match(prompt, /never guess it from the deadline/i, "a far deadline is not the same as not caring");
});

const prioritised = (id, title, priority) => ({ id, title, status: "active", deadline: `${TODAY}T23:00:00`, minutesPerDay: 60, priority });
const sess = (id, itemId, title, start) => ({ id, itemId, title, date: TODAY, start, minutes: 60, done: false });

test("clearing a day by priority removes only the sessions that match", () => {
  const items = [prioritised("g1", "Rust", "high"), prioritised("g2", "Guitar", "low"), prioritised("g3", "Reading", "low")];
  const blocks = [sess("b1", "g1", "Rust", "17:00"), sess("b2", "g2", "Guitar", "19:00"), sess("b3", "g3", "Reading", "21:00")];
  const removed = [];
  const api = createTools({
    plan: () => ({ blocks, fixed: [] }),
    items: () => items,
    onRemoveBlock: ({ id }) => { removed.push(id); return "removed"; },
    onSchedule: () => ({}), onAddGoal: () => ({}), onRemoveGoal: () => "ok", onSetFixed: () => ({}), onMoveBlock: () => "ok",
  });

  const result = api.find((t) => t.function.name === "clear_day").run({ date: TODAY, priority: "low" });

  assert.deepEqual(removed.sort(), ["b2", "b3"], "the high-priority session stays");
  assert.equal(result.removed, 2);
});

test("clearing a day with no priority given takes everything booked that day", () => {
  const items = [prioritised("g1", "Rust", "high")];
  const blocks = [sess("b1", "g1", "Rust", "17:00"), sess("b2", null, "Haircut", "19:00")];
  const removed = [];
  const api = createTools({
    plan: () => ({ blocks, fixed: [] }), items: () => items,
    onRemoveBlock: ({ id }) => { removed.push(id); return "removed"; },
    onSchedule: () => ({}), onAddGoal: () => ({}), onRemoveGoal: () => "ok", onSetFixed: () => ({}), onMoveBlock: () => "ok",
  });

  api.find((t) => t.function.name === "clear_day").run({ date: TODAY });

  assert.deepEqual(removed.sort(), ["b1", "b2"]);
});

test("clearing a day leaves fixed commitments alone — school is not Donna's to cancel", () => {
  const api = createTools({
    plan: () => ({ blocks: [], fixed: [{ id: "f1", title: "School", days: [0,1,2,3,4,5,6], start: "08:00", end: "14:30" }] }),
    items: () => [],
    onRemoveBlock: () => { throw new Error("should not be called"); },
    onSchedule: () => ({}), onAddGoal: () => ({}), onRemoveGoal: () => "ok", onSetFixed: () => ({}), onMoveBlock: () => "ok",
  });

  assert.equal(api.find((t) => t.function.name === "clear_day").run({ date: TODAY }).removed, 0);
});

test("a malformed date is refused rather than clearing the wrong day", () => {
  const { api } = tools();

  assert.throws(() => api.find((t) => t.function.name === "clear_day").run({ date: "tomorrow" }));
});

test("she can save a lasting fact, and it reaches the prompt so she can use it", () => {
  const saved = [];
  const api = createTools({
    plan: () => ({ blocks: [], fixed: [], memories: [] }), items: () => [],
    onRemember: (text) => { saved.push(text); return { id: "m1" }; },
    onForget: () => "ok",
    onSchedule: () => ({}), onAddGoal: () => ({}), onRemoveGoal: () => "ok", onSetFixed: () => ({}), onMoveBlock: () => "ok", onRemoveBlock: () => "ok",
  });

  api.find((t) => t.function.name === "remember").run({ text: "codes best late in the evening" });

  assert.deepEqual(saved, ["codes best late in the evening"]);
  const prompt = systemPrompt({
    plan: { blocks: [], fixed: [], memories: [{ id: "m1", text: "codes best late in the evening" }] },
    items: [], profile: "",
  });
  assert.match(prompt, /codes best late in the evening/);
});

test("what she remembers is something she is told to actually use", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [], memories: [] }, items: [], profile: "" });

  assert.match(prompt, /remember/i);
  assert.match(prompt, /what you know about them|memories/i);
});

test("a fact can be forgotten, but only one that exists", () => {
  const forgotten = [];
  const api = createTools({
    plan: () => ({ blocks: [], fixed: [], memories: [{ id: "m1", text: "hates mornings" }] }), items: () => [],
    onRemember: () => ({}), onForget: ({ id }) => { forgotten.push(id); return "ok"; },
    onSchedule: () => ({}), onAddGoal: () => ({}), onRemoveGoal: () => "ok", onSetFixed: () => ({}), onMoveBlock: () => "ok", onRemoveBlock: () => "ok",
  });
  const remember = api.find((t) => t.function.name === "remember");

  remember.run({ forget_id: "m1" });
  assert.deepEqual(forgotten, ["m1"]);
  assert.throws(() => remember.run({ forget_id: "ghost" }), /no memory/i);
});

test("an empty memory is refused rather than stored as a blank", () => {
  const { api } = tools();

  assert.throws(() => api.find((t) => t.function.name === "remember").run({ text: "   " }));
});

test("she can look for free time inside a window, so 'i work late' is usable", () => {
  const api = createTools({
    plan: () => ({ blocks: [], fixed: [], memories: [] }), items: () => [],
    onRemember: () => ({}), onForget: () => "ok",
    onSchedule: () => ({}), onAddGoal: () => ({}), onRemoveGoal: () => "ok", onSetFixed: () => ({}), onMoveBlock: () => "ok", onRemoveBlock: () => "ok",
  });

  const slots = api.find((t) => t.function.name === "find_free_slots").run({ from_date: TODAY, minutes: 60, earliest: "22:00", latest: "23:59" });

  assert.ok(slots.length > 0);
  assert.ok(slots.every((s) => s.start >= "22:00"), `expected only late slots, got ${JSON.stringify(slots)}`);
});

test("she is given a character, not just a job description", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [], memories: [] }, items: [], profile: "" });

  assert.match(prompt, /never apolog/i, "I'm not apologising for who I am");
  assert.match(prompt, /don't hedge|do not hedge/i);
  assert.match(prompt, /look after them|protect/i, "her job as she sees it: take care of him");
  assert.match(prompt, /without asking permission|don't ask permission/i, "she acts within her remit");
});

test("the sycophantic register is ruled out by name", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [], memories: [] }, items: [], profile: "" });

  for (const phrase of ["great idea", "happy to help", "exclamation"]) {
    assert.match(prompt, new RegExp(phrase, "i"), `expected the prompt to forbid "${phrase}"`);
  }
});

test("the character costs little enough to be worth it", () => {
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [], memories: [] }, items: [], profile: "" });

  assert.ok(prompt.length / 4 < 800, `the whole system prompt should stay well under the old 1168 tokens, got ~${Math.round(prompt.length / 4)}`);
});

test("profile work is a thing she can mark, and is told to", () => {
  const added = [];
  const api = createTools({
    plan: () => ({ blocks: [], fixed: [], memories: [] }), items: () => [],
    onAddGoal: (g) => { added.push(g); return { id: "g1" }; },
    onRemember: () => ({}), onForget: () => "ok", onSchedule: () => ({}),
    onRemoveGoal: () => "ok", onSetFixed: () => ({}), onMoveBlock: () => "ok", onRemoveBlock: () => "ok",
  });

  api.find((t) => t.function.name === "add_goal").run({ title: "Portfolio site", due: "2099-03-01", minutes_per_day: 60, priority: "low", for_profile: true });

  assert.equal(added[0].for_profile, true);
  const prompt = systemPrompt({ plan: { blocks: [], fixed: [], memories: [] }, items: [], profile: "" });
  assert.match(prompt, /portfolio|applications|CV/i);
  assert.match(prompt, /gets them in/i);
});
