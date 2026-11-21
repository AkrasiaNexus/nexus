import { chat } from "./ollama.js";
import { today, addDays, ymd, fromMin, nowMin, toMin, isYmd, WEEKDAYS } from "./time.js";
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
const DONE = {
  add_goal: "added the goal",
  schedule_block: "booked that",
  set_fixed: "set the weekly slot",
  move_block: "moved it",
  remove_block: "removed the session",
  remove_goal: "dropped the goal",
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
  return `You are Donna, this person's secretary. They tell you what they're thinking; you keep their plan.
Their free hours are 07:00-23:00 unless the plan says otherwise.

Change the plan only through the tools. Never claim you changed something you didn't.
First decide what they told you about:
- A one-off thing ("gym at 6pm today for an hour", "call mum tmrw"): schedule_block. It needs no goal and no questions. Missing length: assume 60 minutes.
- A regular weekly thing ("gym mon wed fri 6-7", school, work): set_fixed.
- A goal worked toward over days ("learn rust in 2 weeks"): add_goal. add_goal books its daily sessions itself; tell them the days and times it returns.
- They say when something is: use that time. They don't: pick a slot yourself with find_free_slots, then schedule_block.
- Only for a goal: you need minutes a day, a deadline, and how much it matters. "for 2 weeks", "in 2 weeks", "by friday" are deadlines: work out the date yourself. If any is missing, ask one short question and change nothing.
- How much it matters is their call, not yours: ask how badly they want it, or whether it could wait. "need this" or "can't slip" is high; "whenever", "would be nice", "no rush" is low; anything in between is medium. Never guess it from the deadline alone.
- If they want something booked while another thing is already due, say what's due and ask them to confirm. Do not book it until they say yes.
- They change their mind ("nah drop rust"): remove_goal. Moving or shrinking: move_block, remove_block.

Reply in 1-3 short casual sentences, lowercase, matching their tone. Say what you changed, with the day and time.

How they write: ${profile}

Their plan now:
${JSON.stringify({ goals, sessions: plan.blocks, fixed: plan.fixed })}

Right now: ${WEEKDAYS[now.getDay()]} ${today()} ${fromMin(nowMin())}.`;
}

const schema = (name, description, properties, required) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

// The tools close over the stores so the planner stays testable with fakes.
export function createTools({ plan, items, onSchedule, onRemoveGoal, onSetFixed, onMoveBlock, onRemoveBlock, onAddGoal }) {
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
      ...schema("find_free_slots", "Free gaps of at least `minutes`, searching forward from a date.",
        { from_date: { type: "string" }, minutes: { type: "number" }, days: { type: "number" } }, ["from_date", "minutes"]),
      run: ({ from_date, minutes, days = 7 }) => {
        checkDate(from_date);
        checkMinutes(minutes, DAY_END - DAY_START);
        check(Number.isInteger(days) && days >= 1 && days <= MAX_SEARCH_DAYS, `days must be 1-${MAX_SEARCH_DAYS}`);
        const out = [];
        for (let i = 0; i < days && out.length < 12; i++) out.push(...freeSlots(plan(), addDays(from_date, i), minutes, DAY_START, DAY_END));
        return out.slice(0, 12);
      },
    },
    {
      ...schema("add_goal", "Add something they want to do, once you know minutes a day, the deadline, and how much it matters.",
        { title: { type: "string" }, due: { type: "string" }, minutes_per_day: { type: "number" },
          priority: { type: "string", enum: ["high", "medium", "low"], description: "how much they said it matters, in their words — never inferred from the deadline" } },
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
    for (const call of toolCalls) {
      const tool = tools.find((t) => t.function.name === call.function.name);
      let result;
      try {
        result = tool ? tool.run(call.function.arguments ?? {}) : { error: `no tool called ${call.function.name}` };
      } catch (e) {
        result = { error: e.message };
      }
      if (result?.blocked) ask = result.ask;
      else if (tool && !result?.error) changes.push(call.function.name);
      thread.push({ role: "tool", content: JSON.stringify(result) });
    }
    // Gemma was seen saying "i put it in" over a blocked call; the guard speaks for itself.
    if (ask) {
      const done = [...new Set(changes.map((name) => DONE[name]))];
      return { text: done.length ? `${done.join(", ")}. but ${ask}` : ask, changes };
    }
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
