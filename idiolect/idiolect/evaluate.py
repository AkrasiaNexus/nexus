"""Evaluation in the style of the MultiLexNorm shared task (WNUT 2021).

Word accuracy: share of tokens whose output equals the gold normalization.
ERR (error reduction rate): how much of the gap between the leave-as-is baseline
and perfect normalization a system closes. 0 = no better than doing nothing,
1 = perfect, negative = worse than doing nothing.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .intents import classify
from .normalize import normalize_tokens, tokenize
from .profile import Profile


@dataclass(frozen=True)
class Example:
    id: str
    split: str
    text: str
    norm: list[str]
    intent: str

    @property
    def tokens(self) -> list[str]:
        return tokenize(self.text)


def load_examples(path: str | Path) -> list[Example]:
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    examples = [Example(**row) for row in rows]
    for ex in examples:
        if len(ex.tokens) != len(ex.norm):
            raise ValueError(f"{ex.id}: {len(ex.tokens)} tokens but {len(ex.norm)} gold normalizations")
    return examples


def word_accuracy(examples: list[Example], profile: Profile) -> float:
    total = correct = 0
    for ex in examples:
        pred = normalize_tokens(ex.tokens, profile)
        total += len(ex.norm)
        correct += sum(p == g for p, g in zip(pred, ex.norm))
    return correct / total if total else 0.0


def err(system_acc: float, baseline_acc: float) -> float:
    return (system_acc - baseline_acc) / (1 - baseline_acc) if baseline_acc < 1 else 0.0


def intent_accuracy(examples: list[Example], profile: Profile) -> float:
    return sum(classify(ex.text, profile).label == ex.intent for ex in examples) / len(examples) if examples else 0.0


def learner_report(examples: list[Example], profile: Profile, zipf, vocab_rank, split: str = "test") -> str:
    """Of the non-standard word types the profile misses on a split, how many would the learner surface?"""
    from .learn import suggest

    subset = [ex for ex in examples if ex.split == split]
    gold = {raw: g for ex in subset for raw, g in zip(ex.tokens, ex.norm) if raw != g}
    missing = {raw for raw in gold if raw not in profile.replacements}
    found = suggest([ex.text for ex in subset], zipf, vocab_rank, profile.replacements.keys())
    surfaced = missing & found.tokens
    right_fix = [t for t, fix, *_ in found.typos if gold.get(t) == fix]
    false_typos = [f"{t}->{fix}" for t, fix, *_ in found.typos if t not in gold]
    return (
        f"Learner on {split}: surfaced {len(surfaced)} of {len(missing)} word types the profile missed "
        f"({', '.join(sorted(surfaced))}); missed {', '.join(sorted(missing - surfaced))}.\n"
        f"Typo fixes proposed: {len(found.typos)}, correct: {len(right_fix)}, on correct words: {', '.join(false_typos) or 'none'}.\n"
    )


def report(examples: list[Example], profiles: dict[str, Profile]) -> str:
    splits = sorted({ex.split for ex in examples})
    lines = ["| Profile | " + " | ".join(f"{s} acc | {s} ERR | {s} intent" for s in splits) + " |",
             "|---|" + "---|---|---|" * len(splits)]
    for name, profile in profiles.items():
        cells = []
        for s in splits:
            subset = [ex for ex in examples if ex.split == s]
            base = word_accuracy(subset, Profile())
            acc = word_accuracy(subset, profile)
            cells += [f"{acc:.1%}", f"{err(acc, base):+.2f}", f"{intent_accuracy(subset, profile):.0%}"]
        lines.append(f"| {name} | " + " | ".join(cells) + " |")
    counts = ", ".join(f"{s}: {sum(ex.split == s for ex in examples)} messages, {sum(len(ex.norm) for ex in examples if ex.split == s)} tokens" for s in splits)
    return "\n".join(lines) + f"\n\n{counts}\n"
