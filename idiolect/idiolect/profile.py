"""A profile is a Markdown file that doubles as a system prompt and as data."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

ROW_RE = re.compile(r"^\|(.+)\|\s*$")
SEPARATOR_RE = re.compile(r"^\|[\s:|-]+\|\s*$")


END = "(end)"


@dataclass(frozen=True)
class ContextRule:
    """Replace `written` with `standard` only when the neighbouring words allow it. Empty only_before = any."""
    standard: str
    only_before: frozenset[str] = frozenset()
    not_before: frozenset[str] = frozenset()
    not_after: frozenset[str] = frozenset()

    def applies(self, prev: set[str], nxt: set[str]) -> bool:
        """Neighbours come as {as written, as normalized}: one spelling may allow, any spelling blocks."""
        allowed = not self.only_before or bool(nxt & self.only_before)
        return allowed and not nxt & self.not_before and not prev & self.not_after


@dataclass(frozen=True)
class Profile:
    text: str = ""
    replacements: dict[str, str] = field(default_factory=dict)
    meanings: dict[str, str] = field(default_factory=dict)
    cues: tuple[tuple[str, str], ...] = ()
    hotwords: tuple[str, ...] = ()
    context_rules: dict[str, ContextRule] = field(default_factory=dict)

    def merged(self, other: "Profile") -> "Profile":
        """Combine two profiles; entries in `other` win."""
        return Profile(
            text=(self.text.rstrip() + "\n\n" + other.text).strip(),
            replacements={**self.replacements, **other.replacements},
            meanings={**self.meanings, **other.meanings},
            cues=other.cues + tuple(c for c in self.cues if c not in other.cues),
            hotwords=tuple(dict.fromkeys(self.hotwords + other.hotwords)),
            context_rules={**self.context_rules, **other.context_rules},
        )

    def prompt(self) -> str:
        return self.text

    def whisper_hotwords(self) -> str:
        """Comma-separated vocabulary for faster-whisper's `hotwords` / `initial_prompt`."""
        return ", ".join(self.hotwords)


def _sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current = None
    for line in text.splitlines():
        if line.startswith("## "):
            current = line[3:].strip().lower()
            sections[current] = []
        elif current is not None:
            sections[current].append(line)
    return sections


def _rows(lines: list[str]) -> list[list[str]]:
    table = [line for line in lines if ROW_RE.match(line.strip())]
    body = [line for line in table[1:] if not SEPARATOR_RE.match(line.strip())]
    return [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in body]


def _words(cell: str) -> frozenset[str]:
    return frozenset(w.strip().lower() for w in cell.split(",") if w.strip())


def _context_rules(lines: list[str]) -> dict[str, ContextRule]:
    rules = {}
    for row in _rows(lines):
        written, standard, *conds = row + ["", "", "", ""]
        if standard:
            rules[written.lower()] = ContextRule(standard.lower(), *(_words(c) for c in conds[:3]))
    return rules


def parse(text: str) -> Profile:
    sections = _sections(text)
    replacements: dict[str, str] = {}
    meanings: dict[str, str] = {}
    for written, standard, *meaning in _rows(sections.get("slang", [])):
        replacements[written.lower()] = standard.lower()
        if meaning:
            meanings[written.lower()] = meaning[0]
    for written, correct, *_ in _rows(sections.get("typos", [])):
        replacements[written.lower()] = correct.lower()
    cues = tuple((phrase.lower(), intent.lower()) for phrase, intent, *_ in _rows(sections.get("intent cues", [])))
    hot_lines = " ".join(line.strip("-* ").strip() for line in sections.get("hotwords", []) if line.strip())
    hotwords = tuple(w.strip() for w in hot_lines.split(",") if w.strip())
    return Profile(text=text.strip(), replacements=replacements, meanings=meanings, cues=cues, hotwords=hotwords,
                   context_rules=_context_rules(sections.get("context rules", [])))


def load(*paths: str | Path) -> Profile:
    """Load one or more profiles; later files override earlier ones."""
    profile = Profile()
    for path in paths:
        profile = profile.merged(parse(Path(path).read_text(encoding="utf-8")))
    return profile
