// Which model should Donna run on this machine? Sends Donna's real prompt and real tools to each
// model and reports how long a turn takes and whether it chose the right action.
//
//   node scripts/bench-models.mjs gemma4:12b gemma4:e4b qwen3.5:4b
//
// Each model must already be pulled. Each is unloaded before the next, so a 16GB Mac never holds
// two at once. OLLAMA_URL overrides the address (default http://127.0.0.1:11434).
import fs from "node:fs";
import path from "node:path";
import { createTools, systemPrompt, messagesForModel } from "../src/lib/planner.js";
import { parseProfile, profileForPrompt } from "../src/lib/idiolect.js";
import { today, addDays } from "../src/lib/time.js";

const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const models = process.argv.slice(2);
if (!models.length) {
  console.log("usage: node scripts/bench-models.mjs <model> [<model> ...]   e.g. gemma4:12b gemma4:e4b qwen3.5:4b");
  process.exit(1);
}

// Typed the way the person actually writes, each with the action Donna should take.
const TURNS = [
  { say: "gym at 6pm today for an hour", expect: "schedule_block" },
  { say: "gym mon wed fri 6-7pm", expect: "set_fixed" },
  { say: "lowk wanna learn rust 30 mins a day for 2 wks, need this fr", expect: "add_goal" },
  { say: "when am i free tmrw", expect: "find_free_slots" },
  { say: "i code best late at night", expect: "remember" },
];

const profileText = fs.readFileSync(path.join(HERE, "..", "src", "lib", "profile.md"), "utf8");
const PROFILE = parseProfile(profileText);
const VOICE = profileForPrompt(profileText);
const date = today();
const plan = {
  blocks: [{ id: "b1", itemId: "i1", title: "Essay draft", date, start: "15:00", minutes: 60, done: false }],
  fixed: [{ id: "f1", title: "School", days: [1, 2, 3, 4, 5], start: "08:00", end: "14:30" }],
  memories: [], reminders: [], findings: [], events: [],
};
const items = [{ id: "i1", title: "Essay", status: "active", priority: "high", deadline: new Date(`${addDays(date, 3)}T18:00:00`).toISOString() }];
const noop = () => ({ id: "x" });
const tools = createTools({ plan: () => plan, items: () => items, onSchedule: noop, onAddGoal: noop, onRemoveGoal: noop,
  onSetFixed: noop, onMoveBlock: noop, onRemoveBlock: noop, onRemember: noop, onForget: noop });
const wire = tools.map(({ run, ...schema }) => schema);
const system = systemPrompt({ plan, items, profile: VOICE });

const seconds = (ns) => (ns ?? 0) / 1e9;
const post = async (route, body) => {
  const response = await fetch(`${OLLAMA}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${route} ${response.status}: ${await response.text()}`);
  return response.json();
};

let pulled;
try {
  pulled = new Set((await (await fetch(`${OLLAMA}/api/tags`)).json()).models.map((m) => m.name));
} catch {
  console.log(`Ollama isn't answering at ${OLLAMA}. Start it (open the Ollama app, or run: ollama serve) and try again.`);
  process.exit(1);
}

const results = [];
for (const model of models) {
  if (!pulled.has(model) && !pulled.has(`${model}:latest`)) {
    console.log(`\n${model}: not pulled — run: ollama pull ${model}`);
    continue;
  }
  console.log(`\n${model}`);
  // Loading the weights is a one-off with keep_alive, so it is reported but not counted in a turn.
  const warm = await post("/api/chat", { model, messages: [{ role: "user", content: "hi" }], stream: false, think: false, keep_alive: "10m", options: { num_ctx: 8192 } });
  console.log(`  load ${seconds(warm.load_duration).toFixed(1)}s`);

  const rows = [];
  for (const turn of TURNS) {
    const messages = [{ role: "system", content: system }, ...messagesForModel([{ role: "user", content: turn.say }], PROFILE)];
    const started = Date.now();
    const body = await post("/api/chat", { model, messages, tools: wire, stream: false, think: false, keep_alive: "10m", options: { num_ctx: 8192 } });
    const wall = (Date.now() - started) / 1000;
    const chose = body.message?.tool_calls?.[0]?.function?.name ?? "(replied in words)";
    const row = {
      wall, chose, right: chose === turn.expect,
      promptTokens: body.prompt_eval_count ?? 0,
      prefill: seconds(body.prompt_eval_duration),
      gen: body.eval_count ? body.eval_count / seconds(body.eval_duration) : 0,
    };
    rows.push(row);
    console.log(`  ${row.right ? "ok  " : "MISS"} ${wall.toFixed(1).padStart(5)}s  ${String(row.promptTokens).padStart(5)} prompt tok in ${row.prefill.toFixed(1)}s  ${row.gen.toFixed(0).padStart(3)} tok/s out  "${turn.say}" -> ${chose}`);
  }

  // A working prompt cache reprocesses only what changed, so the later turns read far fewer tokens.
  const first = rows[0].promptTokens;
  const later = rows.slice(1).map((r) => r.promptTokens);
  const cached = later.length && Math.max(...later) < first * 0.5;
  const average = rows.reduce((sum, r) => sum + r.wall, 0) / rows.length;
  results.push({ model, average, right: rows.filter((r) => r.right).length, cached });
  console.log(`  prompt cache: ${cached ? "working" : "NOT reused — every turn re-reads the whole prompt"}`);

  await post("/api/generate", { model, keep_alive: 0 }).catch(() => {});
}

if (results.length) {
  console.log("\n  model                   seconds/turn   right   cache");
  for (const r of results.sort((a, b) => a.average - b.average)) {
    console.log(`  ${r.model.padEnd(22)}  ${r.average.toFixed(1).padStart(10)}s   ${r.right}/${TURNS.length}     ${r.cached ? "yes" : "no"}`);
  }
  console.log("\nFastest with 5/5 right is the one to use:  VITE_OLLAMA_MODEL=<model> npm run tauri dev");
}
