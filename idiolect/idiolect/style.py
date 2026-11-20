"""Aggregate texting-style stats: percentages and counts only, never a message's words."""
from __future__ import annotations

import statistics
import unicodedata
from collections import Counter

from .intents import classify
from .profile import Profile

END_PUNCTUATION = ".!?"


def _emoji(text: str) -> list[str]:
    return [ch for ch in text if unicodedata.category(ch) == "So"]


def _pct(part: int, whole: int) -> str:
    return f"{part / whole:.0%}" if whole else "0%"


def style_report(messages: list[str], profile: Profile) -> str:
    msgs = [m.strip() for m in messages if m.strip()]
    n = len(msgs)
    if not n:
        return "No messages.\n"
    lower = sum(any(c.isalpha() for c in m) and not any(c.isupper() for c in m) for m in msgs)
    bare = sum(not m.rstrip("".join(_emoji(m)) + " ").endswith(tuple(END_PUNCTUATION)) for m in msgs)
    emoji = Counter(e for m in msgs for e in _emoji(m))
    with_emoji = sum(bool(_emoji(m)) for m in msgs)
    intents = Counter(classify(m, profile).label for m in msgs)
    top_emoji = ", ".join(f"{e} x{c}" for e, c in emoji.most_common(5)) or "none"
    lines = [
        "## How I text (aggregate stats, no message content)",
        f"- {n} messages, median {statistics.median(len(m.split()) for m in msgs):g} words each",
        f"- {_pct(lower, n)} all lowercase",
        f"- {_pct(bare, n)} end without . ! or ?",
        f"- emoji in {_pct(with_emoji, n)} of messages; top: {top_emoji}",
        "- intent: " + ", ".join(f"{label} {_pct(c, n)}" for label, c in intents.most_common()),
    ]
    return "\n".join(lines) + "\n"
