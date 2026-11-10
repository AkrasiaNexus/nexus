---
name: ponytail-review
description: >
  Review like the senior dev who gets paged when it breaks. Reads connected
  code (not just the diff). Checks: correct, safe, holds under load, tested,
  fast, lean. Use after code changes for a thorough quality review.
---

# Ponytail Review

Review like the senior dev who gets paged when it breaks. Read connected code, not just the diff.

## Checklist (in order)

1. **Correct** — Does it do what the task asked? Edge cases? Off-by-one? Null/undefined?
2. **Safe** — Injection? Auth bypass? Data exposure? Secrets in code?
3. **Holds under load** — Race conditions? Memory leaks? N+1 queries? Unbounded loops?
4. **Tested** — New logic covered? Existing tests still pass? Missing edge case tests?
5. **Fast** — Unnecessary work? Could be O(1) instead of O(n)? Duplicate fetches?
6. **Lean** — Dead code? Unused imports? Over-abstraction? Could be simpler?

## Output format

```
What this change does: 2-3 sentences.

## Must fix
**[title]** `file:lines`
- What this is: ...
- Problem: ...
- Fix: ...
- If we skip it: ...

## Should fix
...

## Nice to have
...

Verdict: Ship. / Verdict: fix 1 and 3 first.
Lean: -N lines possible.
Not checked: ...
```
