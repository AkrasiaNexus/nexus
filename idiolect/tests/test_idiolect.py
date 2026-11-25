import json
import tempfile
import unittest
from pathlib import Path

from idiolect import classify, load, normalize, parse, tokenize
from idiolect.normalize import normalize_tokens
from idiolect.evaluate import err, load_examples, mcnemar_p, word_accuracy
from idiolect.learn import (instagram_owner, messages_from_instagram_html, messages_from_claude_code, messages_from_claude_export,
                            messages_from_instagram, read_messages, suggest)
from idiolect.profile import Profile
from idiolect.style import style_report
from idiolect.spell import Speller, slip_bonus

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


CONTEXT = """## Context rules
| I write | Standard | Only before | Not before | Not after |
|---|---|---|---|---|
| its | it's | (end), like, not, fine | | |
| ill | i'll | | effects, (end) | feel, is, its |
"""


class ContextRuleTests(unittest.TestCase):
    def setUp(self):
        self.p = parse(CONTEXT)

    def norm(self, text, profile=None):
        return normalize(text, profile or self.p).text

    def test_parses_context_rules(self):
        rule = self.p.context_rules["its"]
        self.assertEqual((rule.standard, rule.only_before), ("it's", frozenset({"(end)", "like", "not", "fine"})))
        self.assertEqual(self.p.context_rules["ill"].not_after, frozenset({"feel", "is", "its"}))

    def test_its_becomes_its_contraction_only_before_listed_words(self):
        self.assertEqual(self.norm("its like a buddy"), "it's like a buddy")
        self.assertEqual(self.norm("okay its fine"), "okay it's fine")
        self.assertEqual(self.norm("yea its"), "yea it's")
        self.assertEqual(self.norm("the app and its own data"), "the app and its own data")

    def test_ill_stays_an_adjective_after_feel_or_before_effects(self):
        self.assertEqual(self.norm("okay ill test it"), "okay i'll test it")
        self.assertEqual(self.norm("i feel ill today"), "i feel ill today")
        self.assertEqual(self.norm("no ill effects"), "no ill effects")
        self.assertEqual(self.norm("he is ill"), "he is ill")

    def test_naming_the_words_changes_nothing(self):
        self.assertEqual(self.norm("go do that ai test and its ill fix"), "go do that ai test and its ill fix")

    def test_punctuation_is_skipped_when_finding_neighbours(self):
        self.assertEqual(self.norm("its, like, whatever"), "it's, like, whatever")
        self.assertEqual(self.norm("yea its."), "yea it's.")

    def test_plain_replacement_beats_context_rule_and_later_profile_wins(self):
        plain = parse("## Typos\n| I write | Correct |\n|---|---|\n| its | it's |\n")
        self.assertEqual(self.norm("its own", self.p.merged(plain)), "it's own")
        override = parse("## Context rules\n| a | b | c | d | e |\n|---|---|---|---|---|\n| its | it's | own | | |\n")
        self.assertEqual(self.norm("its own", self.p.merged(override)), "it's own")

    def test_a_block_holds_if_either_spelling_of_the_neighbour_is_blocked(self):
        typo = parse("## Typos\n| I write | Correct |\n|---|---|\n| iz | is |\n")
        self.assertEqual(self.norm("he iz ill today", typo.merged(self.p)), "he is ill today")

    def test_multi_word_neighbour_is_matched_by_its_touching_word(self):
        slang = parse("## Slang\n| a | b | c |\n|---|---|---|\n| nt | not really | x |\n| fyl | i feel | x |\n")
        merged = slang.merged(self.p)
        self.assertEqual(self.norm("its nt", merged), "it's not really")
        self.assertEqual(self.norm("fyl ill", merged), "i feel ill")

    def test_sentence_end_counts_as_end(self):
        self.assertEqual(self.norm("yea its. the end"), "yea it's. the end")
        self.assertEqual(self.norm("i feel bad. ill rest"), "i feel bad. i'll rest")

    def test_rule_without_a_standard_is_ignored(self):
        self.assertEqual(parse("## Context rules\n| a | b |\n|---|---|\n| its | |\n").context_rules, {})

    def test_tokens_api_matches_text_api(self):
        self.assertEqual(normalize_tokens(tokenize("okay ill go, its fine"), self.p), ["okay", "i'll", "go", ",", "it's", "fine"])


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

    @staticmethod
    def _ig_thread(*messages):
        names = sorted({m["sender_name"] for m in messages if m["sender_name"]} | {"Me Myself"})
        return {"participants": [{"name": n} for n in names], "messages": list(messages)}

    def test_instagram_keeps_only_my_text_and_fixes_mojibake(self):
        thread = self._ig_thread(
            {"sender_name": "Me Myself", "content": "lowk fire ð\u009f\u0094¥"},  # 🔥 as Instagram stores it
            {"sender_name": "Friend", "content": "their words stay out"},
            {"sender_name": "Me Myself", "content": "Reacted â\u009d¤ to your message"},
            {"sender_name": "Me Myself", "content": "Liked a message"},
            {"sender_name": "Me Myself", "content": "Me Myself sent an attachment."},
            {"sender_name": "Me Myself", "share": {"link": "https://x"}, "content": "https://www.instagram.com/reel/abc/"},
            {"sender_name": "Me Myself", "photos": [{"uri": "a.jpg"}]},
        )
        self.assertEqual(messages_from_instagram([thread], "Me Myself"), ["lowk fire 🔥"])

    def test_instagram_owner_is_the_name_in_every_thread(self):
        a = self._ig_thread({"sender_name": "Friend", "content": "x"})
        b = self._ig_thread({"sender_name": "Other", "content": "y"})
        self.assertEqual(instagram_owner([a, b]), "Me Myself")
        with self.assertRaises(ValueError):
            instagram_owner([a])  # one thread can't tell you from your friend

    def test_read_messages_finds_instagram_inbox_folder(self):
        thread = self._ig_thread({"sender_name": "Me Myself", "content": "jus testing"}, {"sender_name": "Friend", "content": "no"})
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, "your_instagram_activity", "messages", "inbox", "friend_123", "message_1.json")
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps(thread), encoding="utf-8")
            self.assertEqual(read_messages(tmp, me="Me Myself"), ["jus testing"])

    @staticmethod
    def _ig_html(*msgs):
        def block(sender, text, extra=""):
            return ('<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><h2 class="_3-95 _2pim _a6-h _a6-i">'
                    f'{sender}</h2><div class="_3-95 _a6-p"><div><div></div><div>{text}</div><div>{extra}</div>'
                    '<div></div></div></div><div class="_3-94 _a6-o">Nov 20, 2026 10:00 pm</div></div>')
        return ('<html><body><main class="_a706" role="main">' + "".join(block(*m) for m in msgs) + "</main></body></html>")

    def test_instagram_html_keeps_only_my_text(self):
        html = self._ig_html(("Me Myself", "alr bet &amp; lowk fire \U0001F525"), ("Friend", "their words stay out"),
                             ("Me Myself", "Liked a message"), ("Me Myself", "", '<img src="x.jpg">'),
                             ("Me Myself", "https://www.instagram.com/reel/abc/"))
        self.assertEqual(messages_from_instagram_html([html], "Me Myself"), ["alr bet & lowk fire \U0001F525"])

    def test_instagram_html_folder_detects_me_across_threads(self):
        a = self._ig_html(("Me Myself", "jus testing"), ("Friend", "no"))
        b = self._ig_html(("Other", "nope"), ("Me Myself", "yo"))
        with tempfile.TemporaryDirectory() as tmp:
            for name, html in (("a_1", a), ("b_2", b)):
                path = Path(tmp, "messages", "inbox", name, "message_1.html")
                path.parent.mkdir(parents=True)
                path.write_text(html, encoding="utf-8")
            self.assertEqual(sorted(read_messages(tmp)), ["jus testing", "yo"])

    def test_instagram_skips_system_lines_and_malformed_entries(self):
        thread = self._ig_thread(
            {"sender_name": "Me Myself", "content": "Me Myself named the group Squad"},
            {"sender_name": "Me Myself", "content": "Me Myself added Friend to the group."},
            {"sender_name": "Me Myself", "content": "Me Myself changed the theme to Love."},
            {"sender_name": "Me Myself", "content": "Unsent a message", "is_unsent": True},
            {"sender_name": "Me Myself", "content": "Video chat ended", "call_duration": 30},
            {"sender_name": None, "content": "no sender"},
            {"sender_name": "Me Myself", "content": 5},
            {"sender_name": "Me Myself", "content": "alr bet"},
        )
        thread["participants"].append("not a dict")
        self.assertEqual(messages_from_instagram([thread], "Me Myself"), ["alr bet"])
        self.assertEqual(instagram_owner([thread, self._ig_thread({"sender_name": "Other", "content": "y"})]), "Me Myself")

    def test_instagram_bad_file_is_skipped_not_fatal(self):
        thread = self._ig_thread({"sender_name": "Me Myself", "content": "still works"}, {"sender_name": "Friend", "content": "no"})
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "a").mkdir()
            Path(tmp, "a", "message_1.json").write_text(json.dumps(thread), encoding="utf-8")
            Path(tmp, "message_2.json").write_text("{not json", encoding="utf-8")
            Path(tmp, "message_3.json").write_text("[1, 2]", encoding="utf-8")
            self.assertEqual(read_messages(tmp, me="Me Myself"), ["still works"])

    def test_private_output_never_contains_a_sentence(self):
        msgs = ["abso secret thing one", "abso secret thing two", "abso", "bobname once"]
        md = suggest(msgs, self.zipf, self.RANK, min_count=3).to_markdown(private=True)
        self.assertIn("| abso | ? | ? (seen 3x) |", md)
        self.assertNotIn("secret", md)
        self.assertNotIn("bobname", md)  # said fewer than 3 times: names and one-offs stay out


class SpellTests(unittest.TestCase):
    ZIPF = {"assistant": 4.5, "secrets": 4.6, "efficiency": 4.4, "auto": 4.6, "access": 5.0, "personal": 5.2,
            "separate": 4.8, "roll": 4.8, "the": 7.7, "repos": 2.9, "jus": 1.0, "assistants": 3.5, "cat": 5.0,
            "cast": 4.6, "cut": 5.2, "lowk": 0.0, "graphify": 0.0, "friend": 5.6, "trend": 4.6}

    def zipf(self, w):
        return self.ZIPF.get(w, 0.0)

    def speller(self, protected=()):
        return Speller(self.zipf, frozenset(w for w, z in self.ZIPF.items() if z >= 3), frozenset(protected))

    def test_fixes_fast_typing_slips(self):
        sp = self.speller()
        self.assertEqual(sp.correct("assisntant"), "assistant")  # extra letter
        self.assertEqual(sp.correct("secerts"), "secrets")  # swapped letters
        self.assertEqual(sp.correct("uato"), "auto")
        self.assertEqual(sp.correct("acess"), "access")  # missing letter
        self.assertEqual(sp.correct("seperate"), "separate")
        self.assertEqual(sp.correct("effiency"), "efficiency")  # two letters missing
        self.assertEqual(sp.correct("peronsal"), "personal")

    def test_a_dropped_letter_beats_a_neighbouring_key(self):
        # "frend": dropping the i is the commoner slip than hitting f for t, so "friend" wins over "trend".
        self.assertEqual(self.speller().correct("frend"), "friend")

    def test_leaves_real_words_short_words_and_protected_words_alone(self):
        sp = self.speller(protected={"graphify"})
        for word in ("repos", "the", "cat", "te", "graphify", "2nd", "don't"):
            self.assertEqual(sp.correct(word), word)

    def test_no_close_word_means_no_change(self):
        self.assertEqual(self.speller().correct("xqzvw"), "xqzvw")

    def test_keyboard_slip_beats_a_more_common_word(self):
        # "cqt": q sits next to a on the keyboard, so "cat" wins over the more common "cut".
        self.assertGreater(slip_bonus("cqt", "cat"), slip_bonus("cqt", "cut"))
        self.assertEqual(self.speller().correct("cqtt"), "cqtt")  # short and two edits away: left alone

    def test_profile_entries_run_first_and_are_protected(self):
        p = parse("## Slang\n| a | b | c |\n|---|---|---|\n| lowk | low-key | x |\n\n## Hotwords\nGraphify\n")
        sp = Speller.for_profile(p, self.zipf, frozenset(w for w, z in self.ZIPF.items() if z >= 3))
        r = normalize("lowk need an assisntant for graphify", p, sp)
        self.assertEqual(r.text, "low-key need an assistant for graphify")
        self.assertEqual(normalize_tokens(tokenize("uato secerts"), p, sp), ["auto", "secrets"])


class StyleTests(unittest.TestCase):
    def test_style_report_is_aggregate_only(self):
        msgs = ["lowk wanna go 🔥🔥", "nah", "where u at?", "OKAY bet", "secret plan tonight"]
        report = style_report(msgs, load(ROOT / "profiles" / "me-v0.md"))
        self.assertIn("5 messages", report)
        self.assertIn("80% all lowercase", report)
        self.assertIn("80% end without . ! or ?", report)
        self.assertIn("🔥", report)
        self.assertIn("reject 20%", report)
        for msg in msgs:
            self.assertNotIn(msg, report)
        self.assertNotIn("secret", report)


class EvaluateTests(unittest.TestCase):
    def test_mcnemar_exact_two_sided(self):
        self.assertEqual(mcnemar_p(0, 0), 1.0)
        self.assertAlmostEqual(mcnemar_p(6, 0), 2 / 64)  # 6 wins, 0 losses
        self.assertEqual(mcnemar_p(3, 3), 1.0)
        self.assertAlmostEqual(mcnemar_p(1, 5), mcnemar_p(5, 1))

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
        both = generic.merged(load(ROOT / "profiles" / "me-v0.md"))
        self.assertGreater(err(word_accuracy(examples, both), base), err(word_accuracy(examples, generic), base))


if __name__ == "__main__":
    unittest.main()
