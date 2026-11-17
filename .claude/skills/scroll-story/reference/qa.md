# QA + Jury

Scripts live in `.claude/skills/scroll-story/scripts/` (Playwright is preinstalled in cloud sessions; run them from any dir with `node`).
All take `URL=` and `TRACK=` (the pinned track selector, default `[data-track]`).

## 1. Build gates
typecheck → lint → unit tests → production build → start the production server (never judge motion in dev mode).

## 2. Visual frames (`frames.cjs`)
Capture ~10 story points on desktop (`MODE=d`) and mobile (`MODE=m`); stitch with ffmpeg `hstack`/`vstack` into contact sheets and LOOK at them:
overlaps between copy and the object, invisible elements, back faces showing mirrored fronts, content stretched or cramped, CTA reachable.

## 3. Consistency (`consistency.cjs`), the bug-catcher
For several targets, compares visible state after slow scrolling vs a direct jump from the far end. Must print `ALL CONSISTENT`.
Catches staggered tweens that never render their final frame, initial states that differ from tween `from` values, and scope rebuild leaks.

## 4. Functional (write per site, ~15 asserts)
- nav links (in-page jumps land on the right chapter; login/signup routes)
- final CTA: `pointer-events:none`/`inert` mid-story, clickable at the end, navigates correctly
- footer links resolve (public, no auth wall)
- reduced motion (`reducedMotion:'reduce'` context): every chapter's text visible, the signature's transform unchanged
- resize desktop → mobile → desktop mid-story keeps the same chapter
- zero `pageerror` / console errors
- the real app still works (run the project's existing E2E)

## 5. Performance (`perf.cjs`)
Wheel through the whole track; expect ~60fps and only a handful of long tasks (headless software GL is pessimistic). Check bundle size of the route in the build output.

## 6. Recording for the user (`record.cjs`)
~45s steady scroll-through → mp4 (command in the script header) → `docs/<name>.mp4` → SendUserFile (display render). Report the preview port if a server is running.

## 7. Jury self-score (be harsh; fix anything < 7)
| Criterion (weight) | Ask |
|---|---|
| Design (40%) | Is there a point of view? Type scale, rhythm, negative space, consistent tokens, micro-details (selection, focus, cursor light)? |
| Usability (30%) | 60fps on a phone? Mobile is designed, not shrunk? Can a stranger find the CTA in 3s? Reduced motion, focus, contrast? |
| Creativity (20%) | Is the signature moment original for this product? Would someone screenshot it? Anything derivative to cut? |
| Content (10%) | Real copy and data (labelled demo where demo), no lorem, no stock-feel imagery? |
Record the scores and the fixes in docs/STORY.md.
