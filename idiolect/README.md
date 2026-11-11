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

The gold set is 19 real messages from one writer ([`data/eval.jsonl`](data/eval.jsonl)), labelled token by token, plus an intent label per message:
- **dev** (6 messages): written *before* the personal profile existed. The profile was built from these.
- **test** (13 messages): written *after* the profile was committed (`cc9f7dc`), so the profile never saw them. Git history proves the order.

| Profile | dev acc | dev ERR | dev intent | test acc | test ERR | test intent |
|---|---|---|---|---|---|---|
| leave as is | 88.3% | +0.00 | 83% | 85.1% | +0.00 | 85% |
| generic slang list (46 entries) | 93.5% | +0.44 | 100% | 93.8% | +0.59 | 100% |
| personal v0 (19 entries) | 97.9% | +0.82 | 83% | 94.5% | +0.63 | 100% |
| **generic + personal v0** | **99.0%** | **+0.91** | 83% | **95.7%** | **+0.71** | 100% |

What it shows:
- **A 19-entry personal profile beats a 46-entry generic list on unseen messages** (ERR 0.63 vs 0.59), and stacking the two is best (0.71).
- **Ambiguous forms need the person.** This writer always means "it's" by *its* and "I'll" by *ill*. A generic tool can't safely make that change, but a personal profile can.
- **A personal rule can be wrong.** v0 said "i wanna build" means *request*, which mislabels a dev message that is really pitching an idea. The table shows it as the 83% dev intent score. Reporting that beats tuning it away.
- Intent accuracy is optimistic: the intent rules were written with all 19 messages visible. Normalization isn't affected, because the profile predates the test split.

Reproduce: `python -m idiolect eval`

## Learning a profile from your chats

```bash
pip install wordfreq
python -m idiolect learn ~/Downloads/conversations.json      # claude.ai export
python -m idiolect learn ~/.claude/projects/                 # Claude Code transcripts
```

The learner ranks your words by **keyness**: how much more often you use a word than English in general does (log10 of your rate over the English rate from `wordfreq`). High-keyness words are slang, names or typos:
- A word one edit away from a much more common word becomes a **typo** suggestion, marked *self-corrected* if you also wrote the right spelling ("charactaer" and "character" in the same message).
- Everything else goes on a **slang** list with example sentences, for you to fill in the meaning.

On the held-out test messages, the learner surfaced **8 of the 14** word types the profile missed (aigh, allat, annd, asw, charactaer, liscense, rooll, seperate). It proposed 6 typo fixes, 4 of them correct, and flagged one correct word (the place name "bateen"). It misses words that are also real English words ("its", "ill", "everyday"), which need context or a human to resolve.

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

## Hotwords
Jarvis, Nexus, forge_change
```

Prose sections such as "How to read me" are ignored by the parser and kept in the prompt. Load several profiles and later ones win: `load("profiles/generic.md", "profiles/me.md")`.

## Use it in an agent

```python
from idiolect import load, normalize, classify

me = load("profiles/generic.md", "profiles/me.md")
system_prompt = me.prompt()                  # any model
clean = normalize(user_text, me).text        # before a small local model
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

21 tests: profile parsing and merging, Unicode-safe tokenization (Arabic, accents, emoji), splice-in-place output, multi-word expansion, intent labels and personal-cue precedence, both chat export formats, the learner's typo and slang logic, ERR maths, gold-alignment validation, and a regression check that the headline result still holds.

## Limitations and next steps

- [ ] Context-aware handling of real-word forms ("its", "ill") with a small sequence model or an LLM pass
- [ ] Bigger gold set from more writers, to report variance across people
- [ ] Measure downstream gains: intent accuracy of a small local model with and without the normalization pass
- [ ] Plug into Nudge's capture box

## License

MIT. See [LICENSE](LICENSE).
