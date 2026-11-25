"""Token-level normalization: one input token maps to one output string (possibly several words).

Replacements are spliced into the original text, so anything not replaced (case,
spacing, punctuation, Arabic, emoji) comes back exactly as written.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from .profile import END, Profile


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


SENTENCE_END = ".!?"


def _neighbour(tokens: list[str], i: int, step: int, profile: Profile) -> set[str]:
    """The nearest word, as written and as normalized (only the word touching ours, if that's several).

    Commas and other symbols are skipped; a sentence end or the message edge counts as (end).
    """
    j = i + step
    while 0 <= j < len(tokens) and not _is_word(tokens[j][0]):
        if tokens[j] in SENTENCE_END:
            return {END}
        j += step
    if not 0 <= j < len(tokens):
        return {END}
    words = profile.replacements.get(tokens[j], tokens[j]).split()
    return {tokens[j], words[0] if step > 0 else words[-1]}


PLAIN_ZIPF = 3.5  # a plain form must be this common in English to count as the word you stretched


def _plain_forms(tok: str) -> list[str]:
    """Unstretched spellings, closest first: "byeeee" -> byee, bye; "goodd" -> good; "jusss" -> juss, jus."""
    forms = []
    for f in (re.sub(r"(.)\1{2,}", r"\1\1", tok), re.sub(r"(.)\1{2,}", r"\1", tok)):
        forms += [f, f[:-1]] if len(f) > 2 and f[-1] == f[-2] else [f]
    return [f for f in dict.fromkeys(forms) if f != tok]


def _destretch(tok: str, profile: Profile, speller) -> str | None:
    """What a stretched word ("yeaa", "frrr", "tooo") means: a profile word first, then a common English word."""
    if speller is not None and (tok in speller.vocab or speller.zipf(tok) >= PLAIN_ZIPF):
        return None  # a real word that happens to repeat a letter: "hiss", "moo", "shhh"
    forms = _plain_forms(tok)
    for f in forms:
        if f in profile.replacements:
            return profile.replacements[f]
    if speller is not None:
        return next((f for f in forms if f in speller.vocab and speller.zipf(f) >= PLAIN_ZIPF), None)
    return None


def _replace(tokens: list[str], i: int, profile: Profile, speller=None) -> str:
    tok = tokens[i]
    if tok in profile.replacements:
        return profile.replacements[tok]
    rule = profile.context_rules.get(tok)
    if rule and rule.applies(_neighbour(tokens, i, -1, profile), _neighbour(tokens, i, 1, profile)):
        return rule.standard
    plain = _destretch(tok, profile, speller) if tok.isalpha() else None
    if plain is not None:
        return plain
    return speller.correct(tok) if speller else tok


def normalize_tokens(tokens: list[str], profile: Profile, speller=None) -> list[str]:
    """`speller` (idiolect.spell.Speller) also repairs typos the profile doesn't list."""
    return [_replace(tokens, i, profile, speller) for i in range(len(tokens))]


def normalize(text: str, profile: Profile, speller=None) -> Normalized:
    spans = token_spans(text)
    raw = [tok for tok, _, _ in spans]
    pieces, tokens, changes = [], [], []
    last = 0
    for i, (tok, start, end) in enumerate(spans):
        new = _replace(raw, i, profile, speller)
        tokens.append(new)
        if new != tok:
            pieces.append(text[last:start])
            pieces.append(new)
            last = end
            changes.append((tok, new))
    pieces.append(text[last:])
    return Normalized(text="".join(pieces), tokens=tokens, changes=changes)
