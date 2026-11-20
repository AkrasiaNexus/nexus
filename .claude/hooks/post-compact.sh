#!/bin/sh
# SessionStart(compact): re-ground the fresh context in the real repo state.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
echo "Context was just compacted. The summary above is a handoff: confirm its next step against the repo before acting."
echo "Branch: $(git branch --show-current 2>/dev/null)"
echo "Recent commits:"; git log --oneline -5 2>/dev/null
echo "Uncommitted:"; git status --short 2>/dev/null | head -20
