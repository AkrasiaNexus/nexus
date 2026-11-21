# Idiolect handoff (stays in the original session)

## Goal
A portable profile of how this user writes (slang, typos, intent) that every AI model can use: as a system prompt, or as a normalizer run in front of small local models.

## State on 21 Nov 2026
- **Tests:** `cd idiolect && python3 -m unittest discover -s tests` passes 46/46. **Eval:** `python3 -m idiolect eval`.
- **Profiles:**
  - `profiles/generic.md`: generic internet slang
  - `profiles/context.md`: its/ill context rules
  - `profiles/me.md`: the **live v1**, written by Claude from all 48 of the user's messages; it has seen every test message
  - `profiles/me-v0.md`: frozen, used for the reproducible eval, the AI-test prompts and the Nudge conformance vectors
- **Automatic typo repair:** `idiolect/spell.py` (`Speller.from_wordfreq(profile)`, CLI `normalize --spell`).
- **Instagram learner:** `learn --private` prints word counts and style stats, never a sentence. The user is still waiting for Meta's export, and it runs on the user's laptop only.
- **AI test:** `tools/llm_intent_eval.py` runs 7 local models (Qwen2.5, Qwen3.5, Gemma 4) through llama-cpp-python. The results are in `data/llm_intent.jsonl` and the README.

## Next
- When the Instagram output arrives, the user pastes it. Fill in the meanings and add rows to `me.md`.
- Grow the gold set with new messages, labelled before any rule changes, as a new split.
- The user's Mac RAM is unknown. Suggest Gemma 4 12B with the profile in the prompt.
