// Donna's brain runs locally: no key, no network, nothing leaves the machine.
export const OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "gemma4:12b";
// Which model runs is a build-time choice — VITE_OLLAMA_MODEL=qwen3.5:4b npm run tauri dev — so
// trying a faster one on a 16GB Mac is a command, not an edit.
export const modelFrom = (env) => String(env?.VITE_OLLAMA_MODEL ?? "").trim() || DEFAULT_MODEL;
export const MODEL = modelFrom(import.meta.env);

// Ollama sizes context from free VRAM and lands on 4096 on a 16GB Mac, which truncates
// the profile and the plan. 8192 fits alongside a 12B on Metal with room for the KV cache.
const NUM_CTX = 8192;
// Measured 21 Nov 2026: with thinking on, gemma4 spent 880 tokens reasoning before "hi"
// (~70s at 12 tok/s). The pushback guard lives in code, so the reasoning buys nothing here.
const THINK = false;
// Donna is used in bursts hours apart; Ollama's default 5m unload makes each burst cold-load 7.7GB.
const KEEP_ALIVE = -1;

export class OllamaDown extends Error {}

export async function chat(messages, tools, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, tools, stream: false, think: THINK, keep_alive: KEEP_ALIVE, options: { num_ctx: NUM_CTX } }),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw new Error("that took too long — try again", { cause });
    throw new OllamaDown("ollama isn't running — start it and try again", { cause });
  }

  if (response.status === 404) throw new OllamaDown(`${MODEL} isn't pulled yet — run: ollama pull ${MODEL}`);
  if (!response.ok) {
    // Ollama says why in the body, and on a 16GB Mac the why is usually memory — the one thing
    // worth knowing when it fails.
    const reason = await Promise.resolve().then(() => response.json()).then((b) => b?.error, () => null);
    throw new Error(reason ? `ollama failed: ${reason}` : `ollama returned ${response.status}`);
  }

  let body;
  try {
    body = await response.json();
  } catch (cause) {
    throw new Error("ollama sent back something unreadable — try again", { cause });
  }
  return { text: (body.message?.content ?? "").trim(), toolCalls: body.message?.tool_calls ?? [] };
}
