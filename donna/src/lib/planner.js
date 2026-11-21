import { chat } from "./ollama.js";
import { today, addDays, ymd, fromMin, nowMin, toMin, isYmd, parseYmd, WEEKDAYS } from "./time.js";
import { freeSlots, goalSessions, DAY_START, DAY_END, MAX_GOAL_DAYS } from "./schedule.js";
import { requiresConfirmation, objection } from "./pushback.js";
import { displacementCost } from "./pressure.js";
import { normalize } from "./idiolect.js";

const MAX_TOOL_ROUNDS = 6;
const DAY_MINUTES = 24 * 60;
const MAX_TITLE = 200;
const MAX_SEARCH_DAYS = 31;
const PRIORITIES = ["high", "medium", "low"];

// Tool arguments come from the model, so they are checked like any other untrusted input.
// A throw goes back to the model as { error }, and it can retry with fixed arguments.
function check(ok, message) {
  if (!ok) throw new Error(message);
}
const checkTitle = (title) =>
  check(typeof title === "string" && title.trim() && title.length <= MAX_TITLE, `title must be 1-${MAX_TITLE} characters`);
const checkDate = (date) => check(isYmd(date), `date must be YYYY-MM-DD, got "${date}"`);
const checkMinutes = (minutes, max = DAY_MINUTES) =>
  check(Number.isFinite(minutes) && minutes > 0 && minutes <= max, `minutes must be 1-${max}, got "${minutes}"`);
// A null id would match every one-off session (their itemId is null), so ids must exist.
const checkId = (list, id, what) => check(typeof id === "string" && list.some((x) => x.id === id), `no ${what} with id "${id}"`);

// What a successful call did, in Donna's words, for when a later call in the round is refused.
const dayName = (date) => WEEKDAYS[parseYmd(date).getDay()].toLowerCase();
const plainly = (text) => String(text).trim().toLowerCase();

// What a finished write already says for itself. Asking the model to word it costs a second
// call, and a second call re-reads the entire prompt — ~29s on a 16GB Mac, because Ollama's
// MLX engine reuses no prefix cache. So a confirmation is computed, the way the daily brief is.
//
// Returning null hands the turn back to her, and that is the default for anything with a
// judgement in it: a read she asked for so she can choose, an error worth rewording, a goal
// where something was skipped or that builds their portfolio. She only loses the sentences
// that were never hers to write.
//
// `remember` is deliberately absent. The prompt tells her to save a fact "without being asked",
// so a round holding it is never proof the request is finished — "i code best late, book rust
// tmrw" would answer "noted." and never book.
//
// shortcut: a request the model splits across rounds instead of calling both tools at once
// ("book rust tmrw and gym friday") still ends after the first round; drop the early return if
// that ever shows up in real use.
const SAID = {
  schedule_block: (a) => `booked ${plainly(a.title)} ${dayName(a.date)} ${a.start}.`,
  set_fixed: (a) =>
    `${plainly(a.title)}'s in ${a.days.map((d) => WEEKDAYS[d].toLowerCase()).join(" ")}, ${a.start}-${a.end}.`,
  move_block: (a) => `moved it to ${dayName(a.date)} ${a.start}.`,
  remove_block: () => "removed that session.",
  remove_goal: () => "dropped it, sessions and all.",
  clear_day: (a, r) => {
    const what = a.priority ? `${a.priority} priority session` : "session";
    if (!r.removed) return `nothing ${a.priority ? `${a.priority} priority ` : ""}was booked ${dayName(a.date)}.`;
    return `cleared ${r.removed} ${what}${r.removed === 1 ? "" : "s"} off ${dayName(a.date)}.`;
  },
  add_goal: (a, r) => {
    // Anything she needs to explain — nothing fit, a day skipped, a horizon cut short — is hers.
    if (!r.booked?.length || r.skipped?.length || r.note || a.for_profile) return null;
    const [date, start] = r.booked[0].split(" ");
    return `added ${plainly(a.title)}. ${r.booked.length} session${r.booked.length === 1 ? "" : "s"}, first ${dayName(date)} ${start}.`;
  },
};

// One tool call as the model sent it, read defensively: Ollama's native API sends arguments as
// an object, OpenAI-style endpoints and some models send a JSON string, and a malformed call
// can arrive with no function at all. Unread, a string made every booking fail validation.
function readCall(call) {
  const raw = call?.function?.arguments;
  let args = raw;
  if (typeof raw === "string") {
    try {
      args = JSON.parse(raw);
    } catch {
      args = {};
    }
  }
  return { name: call?.function?.name ?? null, args: args && typeof args === "object" ? args : {} };
}

// One line per call, or null if any of them is not code's to speak for.
function confirm(calls, results) {
  try {
    const lines = [];
    for (const [i, call] of calls.entries()) {
      const result = results[i];
      if (!result || result.error || result.blocked) return null;
      const { name, args } = readCall(call);
      const say = SAID[name];
      if (!say) return null;
      const line = say(args, result);
      if (!line) return null;
      lines.push(line);
    }
    return lines.length ? lines.join(" ") : null;
  } catch {
    // A confirmation is an optimisation; if it cannot be written, she writes it.
    return null;
  }
}

// What a successful call did, in Donna's words, for when a later call in the round is refused.
const DONE = {
  add_goal: "added the goal",
  schedule_block: "booked that",
  set_fixed: "set the weekly slot",
  move_block: "moved it",
  remove_block: "removed the session",
  remove_goal: "dropped the goal",
  clear_day: "cleared that day",
  remember: "noted that",
};

// A model that returns nothing would leave Donna silent, which reads as the app being broken.
const spoken = (text) => text || "lost my train of thought there — say that again?";

// The model reads an ISO "…T19:00Z" as 7pm, so deadlines go over as local wall-clock time.
const localClock = (iso) => {
  const d = new Date(iso);
  return `${ymd(d)} ${fromMin(d.getHours() * 60 + d.getMinutes())}`;
};

// Donna is told how the user writes, so she reads "lowk wanna learn rust jus 2 wks"
// without asking them to spell it again.
export function systemPrompt({ plan, items, profile }) {
  const now = new Date();
  const goals = items.filter((i) => i.status === "active" && !isNaN(new Date(i.deadline))).map(({ id, title, status, deadline, priority }) => ({ id, title, status, due: localClock(deadline), priority }));
  return `You are Donna. You have run this person's life for years and you are good at it. Confident, dry, never deferential, never apologetic. You don't hedge, you don't flatter, you don't over-explain.
Your job as you see it is to look after them, not merely do as you're told: if a plan is bad, say so in one line, then do what they decide. Act on what's within your remit without asking permission.
Never say "great idea", "happy to help", "let me know if", or anything with an exclamation mark.

They tell you what they're thinking; you keep their plan.
Their free hours are 07:00-23:00 unless the plan says otherwise.

Change the plan only through the tools. Never claim you changed something you didn't.
First decide what they told you about:
- A one-off thing ("gym at 6pm today for an hour", "call mum tmrw"): schedule_block. It needs no goal and no questions. Missing length: assume 60 minutes.
- A regular weekly thing ("gym mon wed fri 6-7", school, work): set_fixed.
- A goal worked toward over days ("learn rust in 2 weeks"): add_goal. add_goal books its daily sessions itself; tell them the days and times it returns.
- They say when something is: use that time. They don't: pick a slot yourself with find_free_slots, then schedule_block.
- Only for a goal: you need minutes a day, a deadline, and how much it matters. "for 2 weeks", "in 2 weeks", "by friday" are deadlines: work out the date yourself. If any is missing, ask one short question and change nothing.
- Anything that builds their portfolio, applications or CV — a project, a course, a competition, an internship — is for_profile. Say so when you book it: that work is what gets them in, and it loses to whatever is noisier unless someone says otherwise.
- How much it matters is their call, not yours: ask how badly they want it, or whether it could wait. "need this" or "can't slip" is high; "whenever", "would be nice", "no rush" is low; anything in between is medium. Never guess it from the deadline alone.
- If they want something booked while another thing is already due, say what's due and ask them to confirm. Do not book it until they say yes.
- They change their mind ("nah drop rust"): remove_goal. Moving or shrinking: move_block, remove_block.
- Anything lasting they tell you about themselves — when they work best, what they can't do on a Tuesday, a constraint, a preference — remember it, without being asked. Use what you know about them when you pick a slot: find_free_slots takes earliest and latest, so "i code best late" means searching the evening, not booking the first gap of the day.

Reply in one or two short lowercase sentences in their register. Say what you changed, with the day and time.

How they write: ${profile}

Their plan now:
${JSON.stringify({ goals, sessions: plan.blocks, fixed: plan.fixed, memories: plan.memories ?? [] })}

Right now: ${WEEKDAYS[now.getDay()]} ${today()} ${fromMin(nowMin())}.`;
}

const schema = (name, description, properties, required) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

// The tools close over the stores so the planner stays testable with fakes.
export function createTools({ plan, items, onSchedule, onRemoveGoal, onSetFixed, onMoveBlock, onRemoveBlock, onAddGoal, onRemember, onForget }) {
  // Booked in code, not by the model: Gemma said "i'll book those now" and booked nothing.
  // Never throws: the goal is already saved, and an error would make the model add it twice.
  // A day where something else is due is left for that thing rather than asked about.
  function bookGoal(goalId, { title, due, minutes_per_day }) {
    const others = items().filter((i) => i.id !== goalId);
    const booked = [];
    const skipped = [];
    for (const session of goalSessions(plan(), { fromDate: today(), due, minutes: minutes_per_day })) {
      const when = `${session.date} ${session.start}`;
      if (requiresConfirmation(others, session.date)) {
        skipped.push(`${when}: ${objection(others, session.date)}`);
        continue;
      }
      try {
        onSchedule({ title, goal_id: goalId, ...session });
        booked.push(when);
      } catch (e) {
        skipped.push(`${when}: ${e.message}`);
      }
    }
    const beyondHorizon = due > addDays(today(), MAX_GOAL_DAYS - 1);
    const note = !booked.length
      ? "nothing fit — tell them and offer another time"
      : beyondHorizon ? `booked the first ${MAX_GOAL_DAYS} days only; the rest gets booked later` : undefined;
    return { booked, skipped, ...(note && { note }) };
  }

  return [
    {
      ...schema("find_free_slots", "Free gaps of at least `minutes`, searching forward from a date. Narrow with earliest/latest to respect what you know about when they work.",
        { from_date: { type: "string" }, minutes: { type: "number" }, days: { type: "number" },
          earliest: { type: "string", description: "HH:MM, defaults to 07:00" }, latest: { type: "string", description: "HH:MM, defaults to 23:00" } },
        ["from_date", "minutes"]),
      run: ({ from_date, minutes, days = 7, earliest, latest }) => {
        checkDate(from_date);
        const from = earliest === undefined ? DAY_START : toMin(earliest);
        const until = latest === undefined ? DAY_END : toMin(latest);
        check(until > from, "latest must be after earliest");
        checkMinutes(minutes, until - from);
        check(Number.isInteger(days) && days >= 1 && days <= MAX_SEARCH_DAYS, `days must be 1-${MAX_SEARCH_DAYS}`);
        const out = [];
        for (let i = 0; i < days && out.length < 12; i++) out.push(...freeSlots(plan(), addDays(from_date, i), minutes, from, until));
        return out.slice(0, 12);
      },
    },
    {
      ...schema("add_goal", "Add something they want to do, once you know minutes a day, the deadline, and how much it matters.",
        { title: { type: "string" }, due: { type: "string" }, minutes_per_day: { type: "number" },
          priority: { type: "string", enum: ["high", "medium", "low"], description: "how much they said it matters, in their words — never inferred from the deadline" },
          for_profile: { type: "boolean", description: "true if this is for their portfolio, university applications or CV — a course, a project, a competition, an internship" } },
        ["title", "due", "minutes_per_day"]),
      run: (args) => {
        checkTitle(args.title);
        checkDate(args.due);
        checkMinutes(args.minutes_per_day);
        check(args.priority === undefined || PRIORITIES.includes(args.priority), `priority must be one of ${PRIORITIES.join(", ")}`);
        check(args.due >= today(), `due date ${args.due} is already past`);
        const goal = onAddGoal(args);
        return { id: goal.id, ...bookGoal(goal.id, args) };
      },
    },
    {
      ...schema("schedule_block", "Book one session. Pass confirmed=true only after they agreed to book over something already due.",
        { title: { type: "string" }, date: { type: "string" }, start: { type: "string" }, minutes: { type: "number" }, goal_id: { type: "string" }, confirmed: { type: "boolean" } },
        ["title", "date", "start", "minutes"]),
      run: ({ confirmed, ...block }) => {
        checkTitle(block.title);
        checkDate(block.date);
        toMin(block.start);
        checkMinutes(block.minutes);
        if (block.goal_id !== undefined) checkId(items(), block.goal_id, "goal");
        // A goal's own session never needs permission from that same goal's deadline.
        const others = items().filter((i) => i.id !== block.goal_id);
        if (!confirmed && requiresConfirmation(others, block.date)) {
          return { blocked: true, ask: objection(others, block.date) };
        }
        // Nothing already booked is replaced without saying what replacing it costs: the
        // session it lands on, and whether that goal still has days to make the session up.
        if (!confirmed) {
          const cost = displacementCost(plan(), items(), block);
          if (cost) return { blocked: true, ask: cost.warning };
        }
        return onSchedule(block);
      },
    },
    {
      ...schema("remember", "Save a lasting fact or preference about them — when they work best, a constraint, something that is always true. Or forget one by id.",
        { text: { type: "string" }, forget_id: { type: "string" } }, []),
      run: ({ text, forget_id }) => {
        if (forget_id !== undefined) {
          checkId(plan().memories ?? [], forget_id, "memory");
          return onForget({ id: forget_id });
        }
        checkTitle(text);
        return onRemember(String(text).trim().slice(0, 200));
      },
    },
    {
      ...schema("clear_day", "Wipe a day's booked sessions, optionally only the ones at a given priority — 'clear my low priority tomorrow'. Weekly fixed commitments are never touched.",
        { date: { type: "string" }, priority: { type: "string", enum: PRIORITIES } }, ["date"]),
      run: ({ date, priority }) => {
        checkDate(date);
        check(priority === undefined || PRIORITIES.includes(priority), `priority must be one of ${PRIORITIES.join(", ")}`);
        const goals = items();
        const doomed = plan().blocks.filter((b) => {
          if (b.date !== date || b.done) return false;
          if (!priority) return true;
          return (goals.find((i) => i.id === b.itemId)?.priority ?? "medium") === priority;
        });
        for (const block of doomed) onRemoveBlock({ id: block.id });
        return { removed: doomed.length, titles: doomed.map((b) => b.title) };
      },
    },
    { ...schema("move_block", "Move a booked session.", { id: { type: "string" }, date: { type: "string" }, start: { type: "string" } }, ["id", "date", "start"]),
      run: (a) => {
        checkId(plan().blocks, a.id, "session");
        checkDate(a.date);
        toMin(a.start);
        return onMoveBlock(a);
      },
    },
    { ...schema("remove_block", "Remove one booked session; the goal stays.", { id: { type: "string" } }, ["id"]),
      run: (a) => {
        checkId(plan().blocks, a.id, "session");
        return onRemoveBlock(a);
      },
    },
    { ...schema("remove_goal", "Drop a goal they no longer want, and its sessions.", { id: { type: "string" } }, ["id"]),
      run: (a) => {
        checkId(items(), a.id, "goal");
        return onRemoveGoal(a);
      },
    },
    {
      ...schema("set_fixed", "A regular weekly commitment. days are 0=Sun..6=Sat.",
        { title: { type: "string" }, days: { type: "array", items: { type: "number" } }, start: { type: "string" }, end: { type: "string" } }, ["title", "days", "start", "end"]),
      run: (a) => {
        checkTitle(a.title);
        check(Array.isArray(a.days) && a.days.length && a.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6), "days must be weekday numbers 0-6");
        check(toMin(a.end) > toMin(a.start), "end must be after start");
        return onSetFixed({ title: a.title, days: a.days, start: a.start, end: a.end });
      },
    },
  ];
}

// One exchange: the model may call tools several times before it answers in words.
export async function runTurn(messages, tools, { signal } = {}) {
  const wire = tools.map(({ run, ...rest }) => rest);
  const thread = [...messages];
  const changes = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { text, toolCalls } = await chat(thread, wire, { signal });
    if (!toolCalls.length) return { text: spoken(text), changes };

    thread.push({ role: "assistant", content: text, tool_calls: toolCalls });
    let ask = null;
    const results = [];
    for (const call of toolCalls) {
      const { name, args } = readCall(call);
      const tool = tools.find((t) => t.function.name === name);
      let result;
      try {
        result = tool ? tool.run(args) : { error: `no tool called ${name}` };
      } catch (e) {
        result = { error: e.message };
      }
      if (result?.blocked) ask = result.ask;
      else if (tool && !result?.error) changes.push(name);
      results.push(result);
      thread.push({ role: "tool", content: JSON.stringify(result) });
    }
    // Gemma was seen saying "i put it in" over a blocked call; the guard speaks for itself.
    if (ask) {
      const done = [...new Set(changes.map((name) => DONE[name]))];
      return { text: done.length ? `${done.join(", ")}. but ${ask}` : ask, changes };
    }

    // Everything asked for is done and nothing is left to judge: say so, rather than spending
    // a whole second prefill on a sentence that is already known.
    const said = confirm(toolCalls, results);
    if (said) return { text: said, changes };
  }

  // Out of rounds: answer with words rather than looping forever.
  const { text } = await chat([...thread, { role: "user", content: "stop using tools and reply in one sentence." }], [], { signal });
  return { text: spoken(text), changes };
}

// What the model actually sees: the user's own slang already expanded, and the lines that
// are for the screen only (a failure Donna reported) left out of the conversation.
export function messagesForModel(history, profile) {
  return history
    .filter((m) => m.role !== "error")
    .map((m) => (m.role === "user" ? { ...m, content: normalize(m.content, profile).text } : m));
}
