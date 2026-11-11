"""Rule-based intent for assistant messages, applied after normalization.

Labels:
  question  asks for information or status
  reject    turns down what the assistant proposed
  approve   a short go-ahead
  context   corrects, constrains or adds requirements to the current work
  pitch     describes the user's own idea
  request   asks the assistant to do, build or find something
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .normalize import normalize
from .profile import Profile

LABELS = ("question", "reject", "approve", "context", "pitch", "request")

QUESTION_RE = re.compile(r"^(what|how|why|where|when|which|who|is there|are there|do you|does)\b|\bwhat about\b")
REJECT_RE = re.compile(r"^(nah|no|nope)\b|\b(these|those|that|all these)( ideas?)? (suck|sucks|are bad)\b")
APPROVE_RE = re.compile(r"^(yeah|yes|yep|yup|sure|bet|ok|okay|alright|go|do it|lock in|let's go)\b|\b(go ahead|do it|lock in|ship it|sounds good)\b")
CONTEXT_RE = re.compile(
    r"\b(i don't want|don't want|i do not want|not just|instead|too far|don't rule out|make it|remember|"
    r"please don't|has to|needs to|should be|it's not like|time is of the essence)\b"
)
PITCH_RE = re.compile(r"\b(idea|ideas|i want to build|basically|it's like a)\b")
REQUEST_RE = re.compile(r"\b(i want you to|give me|build me|build|find|show me|research|create|make me|can you|could you|help me)\b")
APPROVE_MAX_WORDS = 8


@dataclass(frozen=True)
class Intent:
    label: str
    cue: str
    normalized: str


def _first(regex: re.Pattern, text: str) -> str | None:
    m = regex.search(text)
    return m.group(0) if m else None


def classify(text: str, profile: Profile | None = None) -> Intent:
    profile = profile or Profile()
    norm = normalize(text, profile).text.strip().lower()
    # Personal cues beat generic rules, in the same priority order as the labels.
    for label in LABELS:
        for phrase, cue_label in profile.cues:
            if cue_label == label and phrase in norm:
                return Intent(label, phrase, norm)

    words = len(norm.split())
    rules = [
        ("question", QUESTION_RE, True),
        ("reject", REJECT_RE, True),
        ("approve", APPROVE_RE, words <= APPROVE_MAX_WORDS),
        ("context", CONTEXT_RE, True),
        ("pitch", PITCH_RE, True),
        ("request", REQUEST_RE, True),
    ]
    for label, regex, allowed in rules:
        cue = allowed and _first(regex, norm)
        if cue:
            return Intent(label, cue, norm)
    if norm.endswith("?"):
        return Intent("question", "?", norm)
    return Intent("context", "", norm)
