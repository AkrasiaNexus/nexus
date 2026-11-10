"""Mine your own chat history for slang and recurring typos.

Sources:
  - claude.ai export: conversations.json
  - Claude Code transcripts: ~/.claude/projects/**/*.jsonl

Method: rank your words by keyness (how much more often you use a word than
English in general does, in log10 units). High-keyness words are slang, names
or typos. A word becomes a typo suggestion when a much more common word is one
edit away; it's marked "self-corrected" when you also wrote that word yourself.
Everything else goes to a slang list for you to fill in by hand.
"""
from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from .normalize import tokenize

LETTERS = "abcdefghijklmnopqrstuvwxyz'"
MIN_TYPO_LENGTH = 5
MAX_TYPO_ZIPF = 3.0
MIN_FIX_GAIN = 1.5


def _text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(part.get("text", "") for part in content if isinstance(part, dict) and part.get("type") == "text")
    return ""


def messages_from_claude_export(data: list[dict]) -> list[str]:
    out = []
    for convo in data:
        for msg in convo.get("chat_messages", []):
            if msg.get("sender") == "human":
                text = msg.get("text") or _text_of(msg.get("content"))
                if text.strip():
                    out.append(text)
    return out


def messages_from_claude_code(lines: Iterable[str]) -> list[str]:
    out = []
    for line in lines:
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("type") != "user" or entry.get("isMeta"):
            continue
        text = _text_of((entry.get("message") or {}).get("content"))
        if text.strip() and not text.lstrip().startswith("<"):
            out.append(text)
    return out


def read_messages(path: str | Path) -> list[str]:
    path = Path(path)
    if path.is_dir():
        return [m for f in sorted(path.rglob("*.jsonl")) for m in messages_from_claude_code(f.read_text(encoding="utf-8").splitlines())]
    if path.suffix == ".jsonl":
        return messages_from_claude_code(path.read_text(encoding="utf-8").splitlines())
    return messages_from_claude_export(json.loads(path.read_text(encoding="utf-8")))


def edits1(word: str) -> set[str]:
    splits = [(word[:i], word[i:]) for i in range(len(word) + 1)]
    deletes = [a + b[1:] for a, b in splits if b]
    transposes = [a + b[1] + b[0] + b[2:] for a, b in splits if len(b) > 1]
    replaces = [a + c + b[1:] for a, b in splits if b for c in LETTERS]
    inserts = [a + c + b for a, b in splits for c in LETTERS]
    return set(deletes + transposes + replaces + inserts)


@dataclass(frozen=True)
class Suggestions:
    slang: list[tuple[str, int, list[str]]]
    typos: list[tuple[str, str, int, bool]]

    @property
    def tokens(self) -> set[str]:
        return {t for t, *_ in self.slang} | {t for t, *_ in self.typos}

    def to_markdown(self) -> str:
        lines = ["## Slang", "| I write | Standard | Meaning |", "|---|---|---|"]
        lines += [f"| {tok} | ? | ? (seen {n}x, e.g. \"{ex[0][:60]}\") |" for tok, n, ex in self.slang]
        lines += ["", "## Typos", "| I write | Correct | Evidence |", "|---|---|---|"]
        lines += [f"| {tok} | {fix} | {'you also wrote ' + repr(fix) if own else 'one edit from a common word'} |" for tok, fix, _, own in self.typos]
        return "\n".join(lines) + "\n"


def suggest(
    messages: list[str],
    zipf: Callable[[str], float],
    vocab_rank: dict[str, int],
    known_entries: Iterable[str] = (),
    min_keyness: float = 3.0,
    max_examples: int = 2,
) -> Suggestions:
    counts: Counter[str] = Counter()
    examples: dict[str, list[str]] = defaultdict(list)
    for msg in messages:
        toks = tokenize(msg)
        counts.update(toks)
        for tok in set(toks):
            if len(examples[tok]) < max_examples:
                examples[tok].append(" ".join(msg.split()))
    total = sum(counts.values()) or 1
    skip = set(known_entries)

    def keyness(tok: str) -> float:
        return math.log10(counts[tok] / total) - (zipf(tok) - 9)

    slang, typos = [], []
    for tok in sorted(counts, key=keyness, reverse=True):
        if tok in skip or not tok.isalpha() or keyness(tok) < min_keyness:
            continue
        fixes = []
        if len(tok) >= MIN_TYPO_LENGTH and zipf(tok) < MAX_TYPO_ZIPF:
            fixes = [w for w in edits1(tok) if w in vocab_rank and zipf(w) - zipf(tok) >= MIN_FIX_GAIN]
        if fixes:
            fix = min(fixes, key=lambda w: (w not in counts, vocab_rank[w]))
            typos.append((tok, fix, counts[tok], fix in counts))
        else:
            slang.append((tok, counts[tok], examples[tok]))
    return Suggestions(slang=slang, typos=typos)


def wordfreq_backend(vocab_size: int = 50000):
    """English word frequencies from the `wordfreq` package (pip install wordfreq)."""
    try:
        from wordfreq import top_n_list, zipf_frequency
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("Learning needs wordfreq: pip install wordfreq") from exc
    rank = {w: i for i, w in enumerate(top_n_list("en", vocab_size))}
    return (lambda tok: zipf_frequency(tok, "en")), rank
