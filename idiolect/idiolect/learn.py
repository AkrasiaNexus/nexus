"""Mine your own chat history for slang and recurring typos.

Sources:
  - claude.ai export: conversations.json
  - Claude Code transcripts: ~/.claude/projects/**/*.jsonl
  - Instagram "Download your information" export (JSON), your messages only

Method: rank your words by keyness (how much more often you use a word than
English in general does, in log10 units). High-keyness words are slang, names
or typos. A word becomes a typo suggestion when a much more common word is one
edit away; it's marked "self-corrected" when you also wrote that word yourself.
Everything else goes to a slang list for you to fill in by hand.
"""
from __future__ import annotations

import json
import math
import re
import sys
from html.parser import HTMLParser
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


IG_NOISE = re.compile(r"^(reacted .* to your message|liked a message|unsent a message)$", re.I | re.S)
# Group events Instagram logs as if the actor typed them: "<name> named the group X".
IG_EVENT = r"^({who}) (named the group|added .* to the group|left the group|removed .* from the group|changed the |set .*nickname|sent an attachment\.)"


def _fix_mojibake(text: str) -> str:
    # Instagram exports UTF-8 bytes as one \u00XX escape per byte.
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def _str(value) -> str:
    return _fix_mojibake(value) if isinstance(value, str) else ""


def instagram_owner(threads: list[dict]) -> str:
    """The export owner is the only participant in every thread."""
    sets = [{_str(p.get("name")) for p in t.get("participants", []) if isinstance(p, dict)} - {""} for t in threads]
    sets = [s for s in sets if s]
    common = set.intersection(*sets) if len(sets) > 1 else set()
    if len(common) != 1:
        raise ValueError("can't tell which participant is you; pass --me 'Your Instagram name'")
    return common.pop()


def messages_from_instagram(threads: list[dict], me: str) -> list[str]:
    """Only your own typed text: no friends' messages, reactions, shares, calls, unsends or group events.

    shortcut: matches on display name, so a friend with your exact display name would be counted as you.
    """
    event = re.compile(IG_EVENT.format(who="you|" + re.escape(me)), re.I)
    out = []
    for thread in threads:
        for msg in thread.get("messages", []):
            text = _str(msg.get("content")).strip() if isinstance(msg, dict) else ""
            if not text or _str(msg.get("sender_name")) != me or {"share", "is_unsent", "call_duration"} & msg.keys():
                continue
            if not IG_NOISE.match(text) and not event.match(text):
                out.append(text)
    return out


VOID_TAGS = {"img", "br", "hr", "meta", "link", "input", "source", "wbr"}
TEXT_SLOT = 1  # Meta's HTML export puts each message's text in the 2nd of 4 slots (then media, reactions)


class _InstagramHtml(HTMLParser):
    """Collects (sender, slots) per message block of an Instagram "Download your information" HTML page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.messages: list[tuple[str, list[str]]] = []
        self._msg_depth = self._body_depth = None
        self._in_sender = False
        self._sender, self._slots = "", []

    def handle_starttag(self, tag, attrs):
        if tag in VOID_TAGS:
            return
        cls = dict(attrs).get("class") or ""
        self.stack.append(tag)
        depth = len(self.stack)
        if tag == "div" and "_a6-g" in cls.split():
            self._msg_depth, self._sender, self._slots = depth, "", []
        elif self._msg_depth and tag == "h2" and "_a6-h" in cls.split():
            self._in_sender = True
        elif self._msg_depth and tag == "div" and "_a6-p" in cls.split():
            self._body_depth = depth
        elif self._body_depth and tag == "div" and depth == self._body_depth + 2:
            self._slots.append("")

    def handle_endtag(self, tag):
        if tag in VOID_TAGS or not self.stack:
            return
        depth = len(self.stack)
        self.stack.pop()
        if tag == "h2":
            self._in_sender = False
        if self._body_depth and depth == self._body_depth:
            self._body_depth = None
        if self._msg_depth and depth == self._msg_depth:
            self.messages.append((self._sender.strip(), self._slots))
            self._msg_depth = None

    def handle_data(self, data):
        if self._in_sender:
            self._sender += data
        elif self._body_depth and self._slots and len(self.stack) >= self._body_depth + 2:
            self._slots[-1] += data


def _html_messages(html: str) -> list[tuple[str, str]]:
    parser = _InstagramHtml()
    parser.feed(html)
    return [(sender, slots[TEXT_SLOT].strip() if len(slots) > TEXT_SLOT else "") for sender, slots in parser.messages]


def _keep(text: str, me: str) -> bool:
    event = re.compile(IG_EVENT.format(who="you|" + re.escape(me)), re.I)
    is_link = re.fullmatch(r"https?://\S+", text) is not None
    return bool(text) and not is_link and not IG_NOISE.match(text) and not event.match(text)


def messages_from_instagram_html(pages: list[str], me: str) -> list[str]:
    """Only your own typed text from HTML-format exports; same filters as the JSON reader."""
    return [text for page in pages for sender, text in _html_messages(page) if sender == me and _keep(text, me)]


def instagram_html_owner(pages: list[str]) -> str:
    """You are the sender who appears in the most chats; a tie or a single chat can't tell."""
    counts = Counter(s for page in pages for s in {sender for sender, _ in _html_messages(page) if sender})
    top = counts.most_common(2)
    if len(pages) < 2 or not top or (len(top) == 2 and top[0][1] == top[1][1]):
        raise ValueError("can't tell which participant is you; pass --me 'Your Instagram name'")
    return top[0][0]


def _read_threads(files: list[Path]) -> list[dict]:
    threads = []
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as e:
            print(f"skipping {f}: {e}", file=sys.stderr)
            continue
        if isinstance(data, dict):
            threads.append(data)
    return threads


def read_messages(path: str | Path, me: str | None = None) -> list[str]:
    path = Path(path)
    ig_files = sorted(path.rglob("message_*.json")) if path.is_dir() else [path] if path.name.startswith("message_") else []
    if ig_files:
        threads = _read_threads(ig_files)
        return messages_from_instagram(threads, me or instagram_owner(threads))
    html_files = sorted(path.rglob("message_*.html")) if path.is_dir() else []
    if html_files:
        pages = [f.read_text(encoding="utf-8", errors="replace") for f in html_files]
        return messages_from_instagram_html(pages, me or instagram_html_owner(pages))
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


def _example(examples: list[str], private: bool) -> str:
    return "" if private else f', e.g. "{examples[0][:60]}"'


@dataclass(frozen=True)
class Suggestions:
    slang: list[tuple[str, int, list[str]]]
    typos: list[tuple[str, str, int, bool]]

    @property
    def tokens(self) -> set[str]:
        return {t for t, *_ in self.slang} | {t for t, *_ in self.typos}

    def to_markdown(self, private: bool = False) -> str:
        """private=True prints words and counts only, never an example sentence."""
        lines = ["## Slang", "| I write | Standard | Meaning |", "|---|---|---|"]
        lines += [f"| {tok} | ? | ? (seen {n}x{_example(ex, private)}) |" for tok, n, ex in self.slang]
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
    min_count: int = 1,
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
        if tok in skip or not tok.isalpha() or counts[tok] < min_count or keyness(tok) < min_keyness:
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
