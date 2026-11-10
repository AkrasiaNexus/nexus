# Intent

A portable "how I talk" profile that you can give any AI model, so it understands your slang, typos and voice-to-text mistakes without being retrained. It's built for people making their own assistants and agents, where small local models often misread casual input.

> **Status: v0.** The profile format exists and works by pasting it into a system prompt. The learner and the translator below are planned.

## The problem

Large hosted models handle "lowk wanna learn rust jus 2 weeks ykwim" fine. Small local models (Ollama and similar) and voice pipelines often don't. Speech-to-text adds another layer of errors: "Nexus" becomes "next us", "lowk" becomes "local". Every assistant ends up re-learning the same user from scratch.

## What's here

- [`intent.md`](intent.md): a v0 profile with a slang dictionary, typo patterns, intent cues ("yea" after a plan means go ahead; "not jus X" means X is too small) and Whisper hotwords.

## Usage

Paste `intent.md` into the system prompt of whatever model or agent you're using.

For faster-whisper, pass the hotwords list as `initial_prompt` / `hotwords` so it stops mishearing your vocabulary.

## Planned pieces

1. **Profile format.** A stable, documented `intent.md` schema.
2. **Learner.** Reads your chat exports (claude.ai export, Claude Code `~/.claude/projects/*.jsonl`) and generates the profile automatically.
3. **`understand()` translator.** A small library that runs before any agent:
   ```
   understand("lowk wanna learn rust jus 2 weeks")
   -> { intent: "add_goal", clean: "Learn Rust within 2 weeks", confidence: 0.9 }
   ```
4. **Eval set.** About 20 real messages with expected intents, used to measure whether a model reads you correctly with and without the profile.

## Roadmap

- [x] v0 profile from one session
- [ ] Profile schema doc
- [ ] Learner script for chat exports
- [ ] `understand()` library (model-agnostic)
- [ ] Eval set + before/after accuracy numbers
- [ ] Plug into Nudge's capture box

## License

MIT. See [LICENSE](LICENSE).
