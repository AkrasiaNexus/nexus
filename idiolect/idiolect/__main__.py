"""Command line: python -m idiolect <command> ..."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import classify, load, normalize
from .evaluate import learner_report, load_examples, report
from .learn import read_messages, suggest, wordfreq_backend

HERE = Path(__file__).resolve().parent.parent
DEFAULT_PROFILES = [str(HERE / "profiles" / "generic.md"), str(HERE / "profiles" / "me.md")]


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="idiolect", description="A portable profile of how you write, for any AI model.")
    ap.add_argument("-p", "--profile", action="append", help="profile .md file (repeatable, later wins)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("normalize", help="rewrite text into standard English")
    n.add_argument("text")
    i = sub.add_parser("intent", help="classify what the message wants")
    i.add_argument("text")
    sub.add_parser("prompt", help="print the profile as a system prompt")
    sub.add_parser("hotwords", help="print hotwords for faster-whisper")
    lrn = sub.add_parser("learn", help="suggest new profile rows from a chat export")
    lrn.add_argument("source", help="claude.ai conversations.json, a Claude Code .jsonl, or a folder of them")
    lrn.add_argument("--min-keyness", type=float, default=3.0)
    e = sub.add_parser("eval", help="score profiles on a gold set")
    e.add_argument("--data", default=str(HERE / "data" / "eval.jsonl"))
    args = ap.parse_args(argv)

    profile = load(*(args.profile or DEFAULT_PROFILES))
    if args.cmd == "normalize":
        result = normalize(args.text, profile)
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
        print(suggest(read_messages(args.source), zipf, rank, profile.replacements.keys(), args.min_keyness).to_markdown())
    elif args.cmd == "eval":
        here = HERE / "profiles"
        generic, me = load(here / "generic.md"), load(here / "me.md")
        examples = load_examples(args.data)
        print(report(examples, {
            "leave as is": load(),
            "generic slang list": generic,
            "personal v0": me,
            "generic + personal v0": generic.merged(me),
        }))
        try:
            zipf, rank = wordfreq_backend()
        except SystemExit:
            return
        print(learner_report(examples, generic.merged(me), zipf, rank))


if __name__ == "__main__":
    main()
