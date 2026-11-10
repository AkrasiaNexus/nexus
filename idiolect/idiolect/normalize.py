"""Token-level normalization: one input token maps to one output string (possibly several words)."""
from __future__ import annotations

import re
from dataclasses import dataclass

from .profile import Profile

TOKEN_RE = re.compile(r"[a-z0-9]+(?:'[a-z]+)?|[^\sa-z0-9]", re.IGNORECASE)


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


def detokenize(tokens: list[str]) -> str:
    text = " ".join(tokens)
    text = re.sub(r"\s+([.,!?;:)])", r"\1", text)
    text = re.sub(r"(\d): (\d)", r"\1:\2", text)
    return text


@dataclass(frozen=True)
class Normalized:
    text: str
    tokens: list[str]
    changes: list[tuple[str, str]]


def normalize_tokens(tokens: list[str], profile: Profile) -> list[str]:
    return [profile.replacements.get(t, t) for t in tokens]


def normalize(text: str, profile: Profile) -> Normalized:
    raw = tokenize(text)
    out = normalize_tokens(raw, profile)
    changes = [(a, b) for a, b in zip(raw, out) if a != b]
    return Normalized(text=detokenize(out), tokens=out, changes=changes)
