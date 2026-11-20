#!/bin/sh
# PreCompact: stdout is appended to the compaction prompt, so every compact (auto or /compact) becomes a handoff.
cat <<'TXT'
Write the summary as a HANDOFF for a fresh agent, in exactly these sections:
1. Goal: the user's request in their words, plus any standing orders given this session.
2. Done: what was completed, with commit hashes, file paths and artifact URLs.
3. In progress / next step: the exact next action, enough to act on without asking.
4. Key decisions + why: what was chosen, what was rejected and why.
5. Dead ends: approaches tried that failed, so they are not repeated.
6. Files touched: paths, and whether each is committed and pushed.
7. Open questions waiting on the user: quote what was asked.
8. User preferences seen this session that are not already in CLAUDE.md.
Keep exact identifiers (paths, SHAs, URLs, versions, error text). Drop chit-chat, tool output already captured in files, and anything superseded. Redact secrets.
TXT
