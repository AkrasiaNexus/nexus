// Donna's brain runs locally: no key, no network, nothing leaves the machine.
export const OLLAMA_URL = "http://127.0.0.1:11434";
export const MODEL = "gemma4:12b";

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
  if (!response.ok) throw new Error(`ollama returned ${response.status}`);

  const body = await response.json();
  return { text: (body.message?.content ?? "").trim(), toolCalls: body.message?.tool_calls ?? [] };
}
