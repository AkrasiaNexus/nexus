"""Command line: python -m idiolect <command> ..."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import classify, load, normalize
from .evaluate import learner_report, load_examples, report
from .learn import read_messages, suggest, wordfreq_backend
from .spell import Speller
from .style import style_report

HERE = Path(__file__).resolve().parent.parent
PRIVATE_MIN_COUNT = 3  # below this, a word is likely a name or a one-off
DEFAULT_PROFILES = [str(HERE / "profiles" / name) for name in ("generic.md", "context.md", "me.md")]


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="idiolect", description="A portable profile of how you write, for any AI model.")
    ap.add_argument("-p", "--profile", action="append", help="profile .md file (repeatable, later wins)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("normalize", help="rewrite text into standard English")
    n.add_argument("text")
    n.add_argument("--spell", action="store_true", help="also fix typos the profile doesn't list (needs wordfreq)")
    i = sub.add_parser("intent", help="classify what the message wants")
    i.add_argument("text")
    sub.add_parser("prompt", help="print the profile as a system prompt")
    sub.add_parser("hotwords", help="print hotwords for faster-whisper")
    lrn = sub.add_parser("learn", help="suggest new profile rows from a chat export")
    lrn.add_argument("source", help="claude.ai conversations.json, a Claude Code .jsonl or folder, or an Instagram export folder")
    lrn.add_argument("--me", help="your Instagram display name, if it can't be detected")
    lrn.add_argument("--min-keyness", type=float, default=3.0)
    lrn.add_argument("--top", type=int, default=300, help="show the N most used rows of each table (0 = all)")
    lrn.add_argument("--private", action="store_true",
                     help="words, counts and style stats only: no example sentences, nothing said under 3 times")
    e = sub.add_parser("eval", help="score profiles on a gold set")
    e.add_argument("--data", default=str(HERE / "data" / "eval.jsonl"))
    args = ap.parse_args(argv)

    profile = load(*(args.profile or DEFAULT_PROFILES))
    if args.cmd == "normalize":
        speller = Speller.from_wordfreq(profile) if args.spell else None
        result = normalize(args.text, profile, speller)
        print(result.text)
        for a, b in result.changes:
            print(f"  {a} -> {b}")
    elif args.cmd == "intent":
        intent = classify(args.text, profile)
        print(json.dumps({"intent": intent.label, "cue": intent.cue, "normalized": intent.normalized}, ensure_ascii=False))
    elif args.cmd == "prompt":
        print(profile.prompt())
    elif args.cmd == "hotwords":
        print(profile.whisper_hotwords())
    elif args.cmd == "learn":
        zipf, rank = wordfreq_backend()
        try:
            messages = read_messages(args.source, args.me)
        except ValueError as e:
            ap.error(str(e))
        found = suggest(messages, zipf, rank, profile.replacements.keys(), args.min_keyness,
                        min_count=PRIVATE_MIN_COUNT if args.private else 1, limit=max(args.top, 0) or None)
        print(found.to_markdown(private=args.private))
        if args.private:
            print(style_report(messages, profile))
    elif args.cmd == "eval":
        here = HERE / "profiles"
        generic, context, me = load(here / "generic.md"), load(here / "context.md"), load(here / "me-v0.md")
        examples = load_examples(args.data)
        v0 = generic.merged(context).merged(me)
        live = generic.merged(context).merged(load(here / "me.md"))
        try:
            v0_spell = (v0, Speller.from_wordfreq(v0))
            v1_spell = {"generic + context + personal v1 + typo fix (v1 saw every message)": (live, Speller.from_wordfreq(live))}
        except SystemExit:  # wordfreq not installed: skip the typo-fix rows
            v0_spell, v1_spell = None, {}
        print(report(examples, {
            "leave as is": load(),
            "generic slang list": generic,
            "personal v0": me,
            "generic + personal v0": generic.merged(me),
            "generic + context rules + personal v0": v0,
            **({"generic + context rules + personal v0 + typo fix": v0_spell} if v0_spell else {}),
            "generic + context + personal v1 (v1 saw every message)": live,
            **v1_spell,
        }))
        try:
            zipf, rank = wordfreq_backend()
        except SystemExit:
            return
        print(learner_report(examples, generic.merged(context).merged(me), zipf, rank))


if __name__ == "__main__":
    main()
