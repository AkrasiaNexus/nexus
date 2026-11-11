"""Export conformance vectors so other-language ports can prove they match this reference.

    python tools/export_conformance.py OUT.json

Writes the merged default profile text and, for every gold message plus edge cases,
the exact normalized output and change list from the Python implementation.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from idiolect import load, normalize  # noqa: E402

EDGE_CASES = [
    "",
    "JUS SHOUTING ykwim!!",
    "meet at 10:30, ok?",
    "don't touch apostrophes like i'm or you're",
    "u, ur, rn... tho",
    "lowk wanna learn rust jus 2 wks",
    "gotta finish smt by tomorrow",
    "emoji 🙂 and arabic مرحبا stay",
]


def main(out: str) -> None:
    profile = load(ROOT / "profiles" / "generic.md", ROOT / "profiles" / "me.md")
    messages = [json.loads(line)["text"] for line in (ROOT / "data" / "eval.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    vectors = []
    for text in messages + EDGE_CASES:
        result = normalize(text, profile)
        vectors.append({"input": text, "normalized": result.text, "changes": [list(c) for c in result.changes]})
    Path(out).write_text(json.dumps({"profile": profile.prompt(), "vectors": vectors}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(vectors)} vectors to {out}")


if __name__ == "__main__":
    main(sys.argv[1])
