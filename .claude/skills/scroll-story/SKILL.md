---
name: scroll-story
description: Design-team playbook for cinematic, scroll-driven websites (Anime.js / Apple-launch / Awwwards level). Use for ANY new website, landing page, product page, portfolio or campaign site, even when the user gives no concept: invent the story, the signature object and the scroll choreography for whatever product or project is being built, then build, test and record it. Pairs with the impeccable skill (load both).
---

# scroll-story: a design team in one skill

The user's standing brief: every website should feel like animejs.com crossed with an Apple launch page.
That means a continuous, scroll-controlled story, not a stack of sections. They will usually NOT give you the concept.
Inventing it is your job. Run the whole team below, in order, and finish with a recording they can watch.

Load `impeccable` too (project rule). This skill decides the story and motion; impeccable holds the craft floor.

## The team (run every role, in order)

| # | Role | Output | Reference |
|---|------|--------|-----------|
| 1 | **Strategist** | Inspect the product: what it does, who it's for, the one action we want. Read the codebase/brand first. | — |
| 2 | **Creative Director** | One-sentence thesis + the **signature** (object, material or verb) + 2 rejected alternatives. | [concept.md](reference/concept.md) |
| 3 | **Story Architect** | Chapter storyboard: arc, scroll %, what the signature does per chapter, copy. | [concept.md](reference/concept.md) |
| 4 | **Art Director** | World: palette from the brand, type, light, texture, negative space. No new brand. | impeccable + [patterns.md](reference/patterns.md) |
| 5 | **Motion Director** | Choreography per chapter from the pattern catalogue; one signature moment; easing language. | [patterns.md](reference/patterns.md) |
| 6 | **Creative Technologist** | Engine choice, the master timeline, responsive scopes, reduced motion. | [engineering.md](reference/engineering.md) |
| 7 | **QA + Jury** | Scripted tests (fast/slow consistency, functional, perf), visual frames, self-score vs the Awwwards rubric, recording. | [qa.md](reference/qa.md) |

Write the outputs of roles 2–5 into `docs/STORY.md` in the project before coding: thesis, signature, storyboard table, motion notes.
The user can redirect early, and the next session can resume from it.

## Non-negotiables (from juror interviews and this repo's own bugs)

1. **Scroll is the story.** One pinned stage + one master timeline scrubbed by scroll, reversible. No autoplay that drifts from scroll, no scroll-jacking, no video faking it.
2. **One signature moment** people would screenshot (e.g. the phone flips to its camera and scans a bottle). Everything else is restraint.
3. **Design + Usability = 70% of an Awwwards score.** 60fps on a mid-range phone, a real mobile layout (not a shrunken desktop), clear CTA, real content, no placeholder copy.
4. **Accessibility floor:** `prefers-reduced-motion` gets a still, readable version with no spatial motion (WCAG 2.3.3); real HTML text; focus states; hidden-but-present buttons are `inert`.
5. **Honesty:** demo numbers are labelled demo; no fake claims or testimonials.
6. **Prove it:** run [qa.md](reference/qa.md) scripts. Fast-jump and slow-scroll must land on identical visible states. Send the user a recording at the end.

## Default build recipe (Next.js / React; adapt to the project's stack)

- `src/components/landing/` holds: `<Signature/>` (the hero object as a reusable component), `Screens`/scenes, `chapters.ts` (copy), `timeline.ts` (the master timeline), `Cinematic.tsx` (stage markup + scope), CSS files.
- Tall track (`~110vh` per chapter desktop, `~80vh` mobile) → sticky stage `height:100svh`.
- Anime.js v4: `createTimeline({ autoplay: onScroll({ target: track, enter: 'top top', leave: 'bottom bottom', sync: 0.5 }) })`; 1000 units per chapter; `createScope({ mediaQueries })` rebuilds it for mobile and reduced motion.
- The working reference implementation is in this repo: `ecosphere/src/components/landing/` (10 chapters, CSS-3D phone, flip-to-camera scan). Read it before writing a new one. Copy its structure, not its concept.
- **No framework / plain HTML project?** Start from `templates/coin-jars.html`: the same architecture in one file (anime.js from a pinned CDN, 5 chapters, 3D coins → jars, scope for mobile/reduced motion, cursor-reactive hook). It passed consistency (all consistent) and perf (~60fps, 0 long tasks).

## Before you say "done"

- [ ] `docs/STORY.md` exists and matches what shipped
- [ ] typecheck, lint and build are green; existing app tests still pass
- [ ] `qa.md` consistency, functional and perf scripts pass (paste results)
- [ ] desktop and mobile frames reviewed by eye; nothing overlaps, nothing is left invisible
- [ ] reduced-motion pass: every chapter's text is visible and nothing moves
- [ ] self-score against the rubric in qa.md, and fix anything under 7
- [ ] recording sent to the user (SendUserFile) + preview port reported if a server is running
