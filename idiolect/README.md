# Idiolect

**A portable profile of how one person writes, so any AI model understands their slang, typos and intent.**

An *idiolect* is the version of a language that only one person speaks. Big hosted models mostly cope with "lowk wanna learn rust jus 2 weeks ykwim". Small local models, voice pipelines and home-made agents often don't. Every new assistant ends up re-learning the same person from scratch.

Idiolect stores that person once, in a Markdown file that is both:
- a **system prompt** you can paste into any model, and
- **data** the library uses to normalize text and route intent *before* a model sees it.

```text
$ python -m idiolect normalize "lowk i dont wanna rooll the quest everytime ykwim"
low-key i don't want to rooll the quest everytime you know what i mean
  lowk -> low-key
  dont -> don't
  wanna -> want to
  ykwim -> you know what i mean

$ python -m idiolect intent "nah these suck"
{"intent": "reject", "cue": "nah", "normalized": "nah these suck"}
```

## Results

Scored the way the **MultiLexNorm** shared task (WNUT 2021) scores lexical normalization: word accuracy against hand-labelled gold, and **ERR** (error reduction rate), the share of the gap between "leave the text as is" and perfect that a system closes.

The gold set is 37 real messages from one writer ([`data/eval.jsonl`](data/eval.jsonl)), labelled token by token, plus an intent label per message:
- **dev** (6 messages): written *before* the personal profile existed. The profile was built from these.
- **test** (13 messages): written *after* the profile was committed (`cc9f7dc`), so the profile never saw them. Git history proves the order.
- **test2** (18 messages): written ten days later, and labelled and committed (`e34a8c4`) *before* the context rules existed.

| Profile | dev acc | dev ERR | test acc | test ERR | test2 acc | test2 ERR |
|---|---|---|---|---|---|---|
| leave as is | 88.3% | +0.00 | 85.1% | +0.00 | 86.9% | +0.00 |
| generic slang list (46 entries) | 93.5% | +0.44 | 93.8% | +0.59 | 90.8% | +0.30 |
| personal v0 (19 entries) | 97.9% | +0.82 | 94.5% | +0.63 | 91.2% | +0.33 |
| generic + personal v0 | 99.0% | +0.91 | 95.7% | +0.71 | 92.4% | +0.42 |
| generic + context rules + personal v0 | 99.3% | +0.94 | 97.2% | +0.81 | 93.2% | +0.48 |
| **+ automatic typo fix** | **99.3%** | **+0.94** | **98.1%** | **+0.87** | **96.4%** | **+0.73** |
| *generic + context + personal v1 (written by Claude; saw every message)* | *99.7%* | *+0.97* | *99.6%* | *+0.97* | *98.8%* | *+0.91* |

What it shows:
- **A 19-entry personal profile beats a 46-entry generic list on unseen messages** (test ERR 0.63 vs 0.59), and stacking the two is better again.
- **Automatic typo repair catches what no list can.** [`idiolect/spell.py`](idiolect/spell.py) turns a rare word into the most common English word one or two edits away, preferring real finger slips: swapped letters, a neighbouring key, a dropped or doubled letter. On test2 it fixed 8 typos the profile had never seen (assisntant, secerts, effiency, uato, peronsal, acess, subcription, urself) and broke nothing. Across all 37 messages it fixed 14 and broke 2 ("todo" → "too", the place name "bateen" → "batten"), and it guessed wrong on 2 slang words no profile listed yet ("aigh", "allat"); v1 lists all four, which protects them. Over all 48 messages this writer has sent, its only wrong change was a model name ("qwen" → "owen"), which listing names under Hotwords prevents.
- **v1 is the profile Claude wrote** after reading every message, describing how it actually reads this person: slang like alr, asw, ion, idw and wtv, recurring typos, and what phrases like "scrap X", "lock in" and "yo remember" mean. It scores highest, but it has seen every test message, so the italic row is not a held-out result. The honest numbers are the v0 rows above it.
- **Context rules fix words that are also real English words.** "its" and "ill" were the biggest error left: this writer means "it's" and "I'll", but a plain find-and-replace would break "its own" and "feel ill". [`profiles/context.md`](profiles/context.md) changes them only when the neighbouring word makes it clear. Across all 37 messages it fixed 10 tokens and broke none, and it left "do the **its ill** fix" alone, where the words are being named. The one miss is "its aigh", because "aigh" (alright) isn't in any profile yet.
- **The profile ages.** On test2, ten days on, ERR drops to 0.48. Most of the remaining errors are new slang ("alr", "ion", "idw", "wtv") and new typos. That is the case for re-running `learn` regularly.
- Caveats: the context word lists come from English grammar, but the author had seen dev and test while writing them. test2 was labelled before the rules were written, though the same author had read those messages.

### Intent

| Intent | dev | test | test2 |
|---|---|---|---|
| hand-written rules, generic + personal | 83% | 100% | **39%** |

The rule-based intent classifier is **overfit**. Its rules were written with dev and test visible, and on messages it never saw it gets only 7 of 18. Commands like "scrap", "trim" and "remove" match no request rule. The rules are left untuned on purpose, so test2 stays clean. See [Does it help a small model?](#does-it-help-a-small-model) for whether a local LLM does better, with and without Idiolect.

Reproduce: `python -m idiolect eval`

## Does it help a small model?

Each of the 37 messages went to seven local models three ways: **as written**, **normalized** by Idiolect, and as written with the **profile in the system prompt**. The models were Qwen2.5 Instruct (Sept 2024), Qwen3.5 (Feb 2026) and Gemma 4 (Apr 2026), all 4-bit GGUF on CPU with llama.cpp. Each had to answer with one intent label, using the same definitions the gold was labelled with (grammar-constrained, temperature 0). The predictions are saved in [`data/llm_intent.jsonl`](data/llm_intent.jsonl), so the table reproduces without a model: `python tools/llm_intent_eval.py report`.

| Model | as written | normalized | profile in prompt | test2: as written → normalized | test2: as written → profile |
|---|---|---|---|---|---|
| hand-written rules | | 25/37 | | | 7/18 |
| Qwen2.5 0.5B | 9/37 | 9/37 | 10/37 | 5 → 5 | 5 → 6 |
| Qwen2.5 1.5B | 8/37 | 9/37 | 8/37 | 3 → 3 | 3 → 3 |
| Qwen2.5 3B | 14/37 | 15/37 | 18/37 | 7 → 8 | 7 → 11 |
| Qwen2.5 7B | 20/37 | 22/37 | 17/37 | 8 → 9 | 8 → 8 |
| Qwen3.5 4B | 25/37 | **27/37** | 24/37 | 8 → **10** | 8 → 9 |
| Qwen3.5 9B | 24/37 | 25/37 | 24/37 | 7 → 8 | 7 → 10 |
| Gemma 4 12B | 27/37 | 27/37 | **30/37** | 9 → 9 | 9 → **12** |

What it shows:
- **Model generation matters more than anything Idiolect does.** The 2026 models at 4B already beat the 2024 models at 7B, and Gemma 4 12B reads these messages about as well as the hand-written rules do on the messages those rules were written from.
- **Normalizing almost never hurt.** Across all seven models it fixed 10 predictions and broke 3. The direction is consistent, but each model's gain is 0 to 2 messages, too small to call significant on its own. The 10 vs 3 is a tally over the same messages, not an independent test.
- **The profile in the prompt helps the strongest models most.** Gemma 4 12B goes from 9 to 12 of the 18 unseen messages (4 fixed, 1 broken) and to 30 of 37 overall, the best result here. For mid-size models it is a coin flip (the Qwen2.5 7B lost 3 net).
- **The hand-written rules are overfit.** They score 25/37 overall but only 7/18 on unseen messages. Every 2026 model matches or beats that on test2 with no rules at all.
- **Best setup for a personal assistant on a laptop:** a current 4B to 12B model, with the profile in the prompt for the larger ones and normalization in front of the smaller ones.
- Caveats: one person labelled the gold intents, and some model "errors" are arguable. With 18 unseen messages, each message moves the score by about 6 points. The Qwen3.5 and Gemma 4 runs render each model's own chat template with thinking turned off; the earlier runs used llama-cpp-python's built-in chat formatting.

## Learning a profile from your chats

```bash
pip install wordfreq
python -m idiolect learn ~/Downloads/conversations.json      # claude.ai export
python -m idiolect learn ~/.claude/projects/                 # Claude Code transcripts
python -m idiolect learn --private private/instagram/        # Instagram export (your DMs only)
```

Instagram: Accounts Center → Your information and permissions → Download your information → pick **Messages**, format **JSON** (HTML exports work too). Unzip it into `private/` (gitignored) and run it on your own machine; the export never needs to leave it. With `--private` the output is word lists, counts and aggregate style stats (lowercase rate, punctuation, emoji, intent mix) only: no sentences, and no word said fewer than 3 times, which keeps out one-offs. Names you use often still appear, so read it and delete them before you paste it anywhere. Only your own typed messages are read. Friends' messages, reactions, shares, calls, unsends and group events are dropped. You're detected as the one person in every thread; if that's ambiguous, pass `--me "Your display name"`.

The learner ranks your words by **keyness**: how much more often you use a word than English in general does (log10 of your rate over the English rate from `wordfreq`). High-keyness words are slang, names or typos:
- A word one edit away from a much more common word becomes a **typo** suggestion, marked *self-corrected* if you also wrote the right spelling ("charactaer" and "character" in the same message).
- Everything else goes on a **slang** list with example sentences, for you to fill in the meaning.

On the held-out test messages, the learner surfaced **8 of the 14** word types the profile missed (aigh, allat, annd, asw, charactaer, liscense, rooll, seperate). It proposed 4 typo fixes, 3 of them correct, and none on correct words. A fix must look like a finger slip (neighbouring key, swapped or doubled letter) or a vowel mix-up, and be rarer in your writing than the word it fixes. Before that rule it flagged the place name "bateen". Stretched words ("byeeee") count as their plain form, laughs ("lmaoaoqoa", "bahahqhq") are ignored, and duplicate HTML export pages are read once. It misses words that are also real English words ("its", "ill", "everyday"), which need context or a human to resolve.

## Profile format

```markdown
## Slang
| I write | Standard | Meaning |
|---|---|---|
| jus | just | just |

## Typos
| I write | Correct |
|---|---|
| backrgound | background |

## Intent cues
| Phrase | Intent |
|---|---|
| can we build | request |

## Context rules
| I write | Standard | Only before | Not before | Not after |
|---|---|---|---|---|
| ill | i'll | | effects, (end) | feel, is, very |

## Hotwords
Jarvis, Nexus, forge_change
```

Context rules apply only when the nearest word (punctuation skipped, `(end)` = none) passes all three columns; an empty column allows anything. A plain Slang or Typos entry for the same word wins.

Prose sections such as "How to read me" are ignored by the parser and kept in the prompt. Load several profiles and later ones win: `load("profiles/generic.md", "profiles/me.md")`. `profiles/me.md` is the live profile (v1); `profiles/me-v0.md` is frozen so the eval stays reproducible.

## Use it in an agent

```python
from idiolect import load, normalize, classify

me = load("profiles/generic.md", "profiles/context.md", "profiles/me.md")
system_prompt = me.prompt()                  # any model
clean = normalize(user_text, me).text        # before a small local model
from idiolect.spell import Speller            # optional: needs `pip install wordfreq`
clean = normalize(user_text, me, Speller.from_wordfreq(me)).text   # also repair unlisted typos
route = classify(user_text, me).label        # question / reject / approve / context / pitch / request
```

Voice: pass `me.whisper_hotwords()` as faster-whisper's `hotwords` (or `initial_prompt`) so it stops mishearing your vocabulary.

## Design choices

- **No runtime dependencies.** Pure Python 3.10+. `wordfreq` is only needed for `learn` and the learner report.
- **One token in, one output out.** This keeps every change auditable and matches how MultiLexNorm aligns gold labels.
- **Splice, never rebuild.** Replacements are spliced into the original string, so anything not replaced (case, spacing, punctuation, Arabic, emoji) comes back exactly as written. The tokenizer counts letters, combining marks and digits from any script as word characters, so Arabic words with vowel marks stay whole. The first version only knew ASCII and turned "مرحبا" into "م ر ح ب ا"; the cross-language conformance vectors exposed it.
- **Conformance vectors.** `tools/export_conformance.py` writes this implementation's exact outputs, so ports in other languages (Nudge's JavaScript one) can prove they match.
- **The profile is plain Markdown.** It's readable, diffable, works in any model's prompt, and other languages can parse it in about 30 lines.

## Tests

```bash
python -m unittest discover -s tests
```

54 tests: profile parsing and merging, context rules (including naming a word without changing it), automatic typo repair (keyboard slips, dropped letters, protected words), Unicode-safe tokenization (Arabic, accents, emoji), splice-in-place output, multi-word expansion, intent labels and personal-cue precedence, all three chat export formats (claude.ai, Claude Code, Instagram), the learner's typo and slang logic, private mode leaking no sentences, ERR maths, gold-alignment validation, and a regression check that the headline result still holds.

## Limitations and next steps

- [x] Context-aware handling of real-word forms ("its", "ill"): rule table in `profiles/context.md`
- [ ] Bigger gold set from more writers, to report variance across people
- [x] Measure downstream gains: intent accuracy of seven local models (2024 and 2026 generations) with and without normalization (see above)
- [ ] Replace the overfit intent rules with a small model plus normalization, and grow the gold set so gains under 10 points become measurable
- [x] Plug into Nudge's capture box (JavaScript port; context rules not ported yet)

## License

MIT. See [LICENSE](LICENSE).
