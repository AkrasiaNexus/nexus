import json
import tempfile
import unittest
from pathlib import Path

from idiolect import classify, load, normalize, parse, tokenize
from idiolect.evaluate import err, load_examples, word_accuracy
from idiolect.learn import messages_from_claude_code, messages_from_claude_export, suggest
from idiolect.profile import Profile

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = """# Test profile
## How to read me
- casual

## Slang
| I write | Standard | Meaning |
|---|---|---|
| jus | just | just |
| ykwim | you know what i mean | checking in |
| nah | nah | rejecting |

## Typos
| I write | Correct |
|---|---|
| teh | the |

## Intent cues
| Phrase | Intent |
|---|---|
| ship the thing | approve |

## Hotwords
Jarvis, Nexus
"""


class ProfileTests(unittest.TestCase):
    def test_parses_tables_cues_and_hotwords(self):
        p = parse(SAMPLE)
        self.assertEqual(p.replacements["jus"], "just")
        self.assertEqual(p.replacements["teh"], "the")
        self.assertEqual(p.meanings["nah"], "rejecting")
        self.assertEqual(p.cues, (("ship the thing", "approve"),))
        self.assertEqual(p.whisper_hotwords(), "Jarvis, Nexus")
        self.assertIn("How to read me", p.prompt())

    def test_later_profile_wins_on_merge(self):
        base = parse("## Slang\n| a | b | c |\n|---|---|---|\n| u | you | you |\n| x | old | old |\n")
        mine = parse("## Slang\n| a | b | c |\n|---|---|---|\n| x | new | new |\n")
        merged = base.merged(mine)
        self.assertEqual(merged.replacements, {"u": "you", "x": "new"})

    def test_bundled_profiles_load(self):
        p = load(ROOT / "profiles" / "generic.md", ROOT / "profiles" / "me.md")
        self.assertEqual(p.replacements["lowk"], "low-key")
        self.assertEqual(p.replacements["rn"], "right now")
        self.assertIn("forge_change", p.hotwords)


class NormalizeTests(unittest.TestCase):
    def setUp(self):
        self.p = parse(SAMPLE)

    def test_tokenize_keeps_apostrophes_and_splits_punctuation(self):
        self.assertEqual(tokenize("I don't know, ok?"), ["i", "don't", "know", ",", "ok", "?"])

    def test_one_token_can_become_several_words(self):
        r = normalize("jus do it ykwim", self.p)
        self.assertEqual(r.text, "just do it you know what i mean")
        self.assertEqual(r.changes, [("jus", "just"), ("ykwim", "you know what i mean")])

    def test_detokenize_tidies_punctuation_and_times(self):
        self.assertEqual(normalize("teh bus is at 10:30, ok?", self.p).text, "the bus is at 10:30, ok?")

    def test_unknown_words_are_left_alone(self):
        self.assertEqual(normalize("totally normal sentence", self.p).changes, [])

    def test_arabic_accents_and_emoji_survive_untouched(self):
        text = "jus said مرحبا to the café 🙂 and مَرْحَبًا ❤️"
        self.assertEqual(normalize(text, self.p).text, "just said مرحبا to the café 🙂 and مَرْحَبًا ❤️")

    def test_only_replaced_words_change_case_spacing_and_punctuation_stay(self):
        self.assertEqual(normalize("JUS   go, OK?", self.p).text, "just   go, OK?")

    def test_arabic_words_are_single_tokens(self):
        self.assertEqual(tokenize("قال مرحبا!"), ["قال", "مرحبا", "!"])


class IntentTests(unittest.TestCase):
    def test_labels(self):
        cases = {
            "what about the other build": "question",
            "nah these ideas suck": "reject",
            "yea do it": "approve",
            "i dont want it to be a chrome extension": "context",
            "basically my idea is a tray app": "pitch",
            "build me a landing page": "request",
            "is it done?": "question",
        }
        p = load(ROOT / "profiles" / "generic.md")
        for text, label in cases.items():
            with self.subTest(text=text):
                self.assertEqual(classify(text, p).label, label)

    def test_approve_only_for_short_messages(self):
        long = "yeah so basically my idea is that it plans my whole week around my schedule"
        self.assertNotEqual(classify(long).label, "approve")

    def test_personal_cue_beats_generic_rules(self):
        p = parse(SAMPLE)
        self.assertEqual(classify("can you ship the thing", p).label, "approve")

    def test_normalization_feeds_intent(self):
        p = parse(SAMPLE)
        self.assertEqual(classify("jus build me a tray app", p).normalized, "just build me a tray app")


class LearnTests(unittest.TestCase):
    ZIPF = {"the": 7.7, "character": 5.5, "charcter": 0.0, "abso": 1.0, "real": 5.5, "word": 5.6}
    RANK = {"the": 0, "character": 900, "real": 300, "word": 200}

    def zipf(self, tok):
        return self.ZIPF.get(tok, 6.0)

    def test_self_corrected_typo_and_slang(self):
        msgs = ["main charcter shot and main character spot", "abso real word", "abso"]
        s = suggest(msgs, self.zipf, self.RANK)
        self.assertIn(("charcter", "character", 1, True), s.typos)
        self.assertEqual([t for t, *_ in s.slang], ["abso"])
        self.assertIn("| charcter | character | you also wrote 'character' |", s.to_markdown())

    def test_known_entries_are_skipped(self):
        s = suggest(["abso abso"], self.zipf, self.RANK, known_entries=["abso"])
        self.assertEqual(s.tokens, set())

    def test_reads_claude_ai_export(self):
        data = [{"chat_messages": [
            {"sender": "human", "text": "yo build it"},
            {"sender": "assistant", "text": "ok"},
            {"sender": "human", "text": "", "content": [{"type": "text", "text": "and test it"}]},
        ]}]
        self.assertEqual(messages_from_claude_export(data), ["yo build it", "and test it"])

    def test_reads_claude_code_transcript(self):
        lines = [
            json.dumps({"type": "user", "message": {"content": "jus ship it"}}),
            json.dumps({"type": "user", "message": {"content": [{"type": "tool_result", "content": "x"}]}}),
            json.dumps({"type": "user", "isMeta": True, "message": {"content": "meta"}}),
            json.dumps({"type": "user", "message": {"content": "<command-name>/model</command-name>"}}),
            json.dumps({"type": "assistant", "message": {"content": "hi"}}),
            "not json",
        ]
        self.assertEqual(messages_from_claude_code(lines), ["jus ship it"])


class EvaluateTests(unittest.TestCase):
    def test_err(self):
        self.assertEqual(err(0.9, 0.9), 0.0)
        self.assertEqual(err(1.0, 0.8), 1.0)
        self.assertAlmostEqual(err(0.9, 0.8), 0.5)
        self.assertLess(err(0.7, 0.8), 0)

    def test_rejects_misaligned_gold(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "bad.jsonl"
            path.write_text(json.dumps({"id": "x", "split": "dev", "text": "jus go", "norm": ["just"], "intent": "request"}))
            with self.assertRaises(ValueError):
                load_examples(path)

    def test_headline_result_holds(self):
        """Personal profile adds to the generic list on held-out messages."""
        examples = [ex for ex in load_examples(ROOT / "data" / "eval.jsonl") if ex.split == "test"]
        base = word_accuracy(examples, Profile())
        generic = load(ROOT / "profiles" / "generic.md")
        both = generic.merged(load(ROOT / "profiles" / "me.md"))
        self.assertGreater(err(word_accuracy(examples, both), base), err(word_accuracy(examples, generic), base))


if __name__ == "__main__":
    unittest.main()
