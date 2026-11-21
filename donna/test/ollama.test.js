import test from "node:test";
import assert from "node:assert/strict";
import { chat, OllamaDown, MODEL } from "../src/lib/ollama.js";

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test("a plain reply comes back as trimmed text with no tool calls", async () => {
  const restore = stubFetch(async () => ok({ message: { content: "  booked it for 7pm.  " } }));

  const { text, toolCalls } = await chat([{ role: "user", content: "hi" }], []);

  assert.equal(text, "booked it for 7pm.");
  assert.deepEqual(toolCalls, []);
  restore();
});

test("tool calls are handed back untouched", async () => {
  const call = { function: { name: "schedule_block", arguments: { title: "Rust", start: "19:00" } } };
  const restore = stubFetch(async () => ok({ message: { content: "", tool_calls: [call] } }));

  const { toolCalls } = await chat([], []);

  assert.deepEqual(toolCalls, [call]);
  restore();
});

test("the request pins the model and a context big enough for the profile and plan", async () => {
  let sent;
  const restore = stubFetch(async (_url, init) => { sent = JSON.parse(init.body); return ok({ message: { content: "" } }); });

  await chat([{ role: "user", content: "hi" }], [{ name: "add_goal" }]);

  assert.equal(sent.model, MODEL);
  assert.equal(sent.stream, false);
  assert.ok(sent.options.num_ctx >= 8192, "4096 would truncate the profile");
  assert.deepEqual(sent.tools, [{ name: "add_goal" }]);
  restore();
});

test("a dead server is reported as something the user can fix, not a raw network error", async () => {
  const restore = stubFetch(async () => { throw new TypeError("fetch failed"); });

  await assert.rejects(chat([], []), (e) => e instanceof OllamaDown && /isn't running/.test(e.message));
  restore();
});

test("a model that was never pulled says so, with the command to fix it", async () => {
  const restore = stubFetch(async () => ({ ok: false, status: 404 }));

  await assert.rejects(chat([], []), (e) => e instanceof OllamaDown && e.message.includes(`ollama pull ${MODEL}`));
  restore();
});

test("any other failure surfaces the status rather than pretending it worked", async () => {
  const restore = stubFetch(async () => ({ ok: false, status: 500 }));

  await assert.rejects(chat([], []), /ollama returned 500/);
  restore();
});
