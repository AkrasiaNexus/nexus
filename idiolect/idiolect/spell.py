"""Automatic typo repair for fast typing.

A word that is rare in English becomes the most common English word one edit away
(two for longer words), preferring the slips a keyboard actually makes: swapped
letters, a neighbouring key, a doubled or dropped letter. Profile words (slang,
hotwords, context rules) are never touched, and the profile's own replacements run first.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Iterable

from .learn import MAX_TYPO_ZIPF, MIN_FIX_GAIN, edits1
from .profile import Profile

MIN_LENGTH = 4  # shorter words have too many real neighbours ("te" could be "the", "to", "tea")
EDITS2_MIN_LENGTH = 6
EDITS2_MAX_LENGTH = 12  # the two-edit search grows with length squared; longer tokens are usually IDs or URLs
SLIP = 1.0  # zipf points: a keyboard slip counts as much as a word being 10x more common
HALF_SLIP = 0.5
ROWS = ("qwertyuiop", "asdfghjkl", "zxcvbnm")
ROW_OFFSET = (0.0, 0.25, 0.75)
KEY_POS = {ch: (r, c + ROW_OFFSET[r]) for r, row in enumerate(ROWS) for c, ch in enumerate(row)}


def _adjacent(a: str, b: str) -> bool:
    if a not in KEY_POS or b not in KEY_POS:
        return False
    (r1, c1), (r2, c2) = KEY_POS[a], KEY_POS[b]
    return a != b and abs(r1 - r2) <= 1 and abs(c1 - c2) <= 1.0


def slip_bonus(typo: str, word: str) -> float:
    """How much `typo` looks like a finger slip while typing `word`."""
    if len(typo) == len(word):
        diffs = [i for i, (x, y) in enumerate(zip(typo, word)) if x != y]
        if len(diffs) == 1:
            return SLIP if _adjacent(typo[diffs[0]], word[diffs[0]]) else 0.0
        if len(diffs) == 2 and diffs[1] == diffs[0] + 1 and typo[diffs[0]] == word[diffs[1]] and typo[diffs[1]] == word[diffs[0]]:
            return SLIP
        return 0.0
    longer, shorter = (typo, word) if len(typo) > len(word) else (word, typo)
    if len(longer) - len(shorter) != 1:
        return 0.0
    i = next((k for k, (x, y) in enumerate(zip(longer, shorter)) if x != y), len(shorter))
    extra = longer[i]
    neighbours = longer[max(0, i - 1):i] + longer[i + 1:i + 2]
    near = any(extra == n or _adjacent(extra, n) for n in neighbours)
    if len(typo) < len(word):  # a dropped letter is the most common fast-typing slip
        return HALF_SLIP + (HALF_SLIP if near else 0.0)
    return HALF_SLIP if near else 0.0


def _profile_words(profile: Profile) -> frozenset[str]:
    words: set[str] = set(h.lower() for h in profile.hotwords)
    for written, standard in profile.replacements.items():
        words.add(written)
        words.update(standard.split())
    for written, rule in profile.context_rules.items():
        words.add(written)
        words.update(rule.standard.split())
    return frozenset(words)


@dataclass(frozen=True)
class Speller:
    zipf: Callable[[str], float]
    vocab: frozenset[str]
    protected: frozenset[str] = frozenset()
    _cache: dict = field(default_factory=dict, compare=False, repr=False)

    @classmethod
    def for_profile(cls, profile: Profile, zipf: Callable[[str], float], vocab: Iterable[str]) -> "Speller":
        return cls(zipf, frozenset(vocab), _profile_words(profile))

    @classmethod
    def from_wordfreq(cls, profile: Profile) -> "Speller":
        from .learn import wordfreq_backend

        zipf, rank = wordfreq_backend()
        return cls.for_profile(profile, zipf, rank)

    def _candidates(self, word: str) -> set[str]:
        near = edits1(word)
        found = near & self.vocab
        if found or not EDITS2_MIN_LENGTH <= len(word) <= EDITS2_MAX_LENGTH:
            return found
        return {w2 for w1 in near for w2 in edits1(w1) if w2 in self.vocab}

    def correct(self, word: str) -> str:
        if word not in self._cache:
            self._cache[word] = self._correct(word)
        return self._cache[word]

    def _correct(self, word: str) -> str:
        if len(word) < MIN_LENGTH or not word.isalpha() or word in self.protected:
            return word
        own = self.zipf(word)
        if own >= MAX_TYPO_ZIPF:
            return word
        candidates = self._candidates(word)
        if not candidates:
            return word
        best = max(candidates, key=lambda c: (self.zipf(c) + slip_bonus(word, c), c))
        return best if self.zipf(best) - own >= MIN_FIX_GAIN else word
