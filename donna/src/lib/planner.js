import { chat } from "./ollama.js";
import { today, addDays, WEEKDAYS } from "./time.js";
import { freeSlots, DAY_START, DAY_END } from "./schedule.js";
import { requiresConfirmation, objection } from "./pushback.js";

const MAX_TOOL_ROUNDS = 6;

// A model that returns nothing would leave Donna silent, which reads as the app being broken.
const spoken = (text) => text || "lost my train of thought there — say that again?";

// Donna is told how the user writes, so she reads "lowk wanna learn rust jus 2 wks"
// without asking them to spell it again.
export function systemPrompt({ plan, items, profile }) {
  const now = new Date();
  return `You are Donna, this person's secretary. They tell you what they're thinking; you keep their plan.
Right now: ${WEEKDAYS[now.getDay()]} ${today()}. Their free hours are 07:00-23:00 unless the plan says otherwise.

Change the plan only through the tools. Never claim you changed something you didn't.
- They say when something is: use that time. They don't: pick a slot yourself with find_free_slots, then schedule_block.
- Before adding a goal you need minutes a day and a deadline. If either is missing, ask one short question and change nothing.
- If they want something booked while another thing is already due, say what's due and ask them to confirm. Do not book it until they say yes.
- They change their mind ("nah drop rust"): remove_goal. Moving or shrinking: move_block, remove_block.
- Regular weekly things (school, work, gym): set_fixed.

Reply in 1-3 short casual sentences, lowercase, matching their tone. Say what you changed, with the day and time.

How they write: ${profile}

Their plan now:
${JSON.stringify({ goals: items, sessions: plan.blocks, fixed: plan.fixed })}`;
}

const schema = (name, description, properties, required) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

// The tools close over the stores so the planner stays testable with fakes.
export function createTools({ plan, items, onSchedule, onRemoveGoal, onSetFixed, onMoveBlock, onRemoveBlock, onAddGoal }) {
  return [
    {
      ...schema("find_free_slots", "Free gaps of at least `minutes`, searching forward from a date.",
        { from_date: { type: "string" }, minutes: { type: "number" }, days: { type: "number" } }, ["from_date", "minutes"]),
      run: ({ from_date, minutes, days = 7 }) => {
        const out = [];
        for (let i = 0; i < days && out.length < 12; i++) out.push(...freeSlots(plan(), addDays(from_date, i), minutes, DAY_START, DAY_END));
        return out.slice(0, 12);
      },
    },
    {
      ...schema("add_goal", "Add something they want to do, once you know minutes a day and the deadline.",
        { title: { type: "string" }, due: { type: "string" }, minutes_per_day: { type: "number" }, priority: { type: "string", enum: ["high", "medium", "low"] } },
        ["title", "due", "minutes_per_day"]),
      run: (args) => onAddGoal(args),
    },
    {
      ...schema("schedule_block", "Book one session. Pass confirmed=true only after they agreed to book over something already due.",
        { title: { type: "string" }, date: { type: "string" }, start: { type: "string" }, minutes: { type: "number" }, goal_id: { type: "string" }, confirmed: { type: "boolean" } },
        ["title", "date", "start", "minutes"]),
      run: ({ confirmed, ...block }) => {
        if (!confirmed && requiresConfirmation(items(), block.date)) {
          return { blocked: true, ask: objection(items(), block.date) };
        }
        return onSchedule(block);
      },
    },
    { ...schema("move_block", "Move a booked session.", { id: { type: "string" }, date: { type: "string" }, start: { type: "string" } }, ["id", "date", "start"]), run: (a) => onMoveBlock(a) },
    { ...schema("remove_block", "Remove one booked session; the goal stays.", { id: { type: "string" } }, ["id"]), run: (a) => onRemoveBlock(a) },
    { ...schema("remove_goal", "Drop a goal they no longer want, and its sessions.", { id: { type: "string" } }, ["id"]), run: (a) => onRemoveGoal(a) },
    {
      ...schema("set_fixed", "A regular weekly commitment. days are 0=Sun..6=Sat.",
        { title: { type: "string" }, days: { type: "array", items: { type: "number" } }, start: { type: "string" }, end: { type: "string" } }, ["title", "days", "start", "end"]),
      run: (a) => onSetFixed(a),
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
    for (const call of toolCalls) {
      const tool = tools.find((t) => t.function.name === call.function.name);
      let result;
      try {
        result = tool ? tool.run(call.function.arguments ?? {}) : { error: `no tool called ${call.function.name}` };
      } catch (e) {
        result = { error: e.message };
      }
      if (tool && !result?.error && !result?.blocked) changes.push(call.function.name);
      thread.push({ role: "tool", content: JSON.stringify(result) });
    }
  }

  // Out of rounds: answer with words rather than looping forever.
  const { text } = await chat([...thread, { role: "user", content: "stop using tools and reply in one sentence." }], [], { signal });
  return { text: spoken(text), changes };
}
