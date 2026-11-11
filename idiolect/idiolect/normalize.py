"""Token-level normalization: one input token maps to one output string (possibly several words).

Replacements are spliced into the original text, so anything not replaced (case,
spacing, punctuation, Arabic, emoji) comes back exactly as written.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from .profile import Profile


def _is_word(ch: str) -> bool:
    # Letters, combining marks (Arabic harakat, accents) and digits from any script.
    return unicodedata.category(ch)[0] in "LMN"


def token_spans(text: str) -> list[tuple[str, int, int]]:
    """(lowercased token, start, end) for words, words with one inner apostrophe, and single symbols."""
    spans = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch.isspace():
            i += 1
            continue
        if not _is_word(ch):
            spans.append((ch.lower(), i, i + 1))
            i += 1
            continue
        j = i
        while j < n and _is_word(text[j]):
            j += 1
        if j + 1 < n and text[j] == "'" and _is_word(text[j + 1]):
            j += 1
            while j < n and _is_word(text[j]):
                j += 1
        spans.append((text[i:j].lower(), i, j))
        i = j
    return spans


def tokenize(text: str) -> list[str]:
    return [tok for tok, _, _ in token_spans(text)]


@dataclass(frozen=True)
class Normalized:
    text: str
    tokens: list[str]
    changes: list[tuple[str, str]]


def normalize_tokens(tokens: list[str], profile: Profile) -> list[str]:
    return [profile.replacements.get(t, t) for t in tokens]


def normalize(text: str, profile: Profile) -> Normalized:
    pieces, tokens, changes = [], [], []
    last = 0
    for tok, start, end in token_spans(text):
        new = profile.replacements.get(tok, tok)
        tokens.append(new)
        if new != tok:
            pieces.append(text[last:start])
            pieces.append(new)
            last = end
            changes.append((tok, new))
    pieces.append(text[last:])
    return Normalized(text="".join(pieces), tokens=tokens, changes=changes)
