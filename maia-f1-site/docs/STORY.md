# Hermes V1: story doc

**Source rule:** every fact on the site comes from the team's Enterprise and Engineering portfolios (STEM Racing UAE
2026–27) and the car STL. Nothing is added from outside them. The one exception is the Pleiades artwork, which the team
asked for: star positions are catalogue data, and only Maia is labelled.

## Strategist
- **Product:** Hermes V1, Team MAIA's car, and the six people who built it.
- **Audience:** judges, sponsors (the portfolio targets small and growing businesses), the school and STEM Racing UAE.
- **The one action:** sponsors reach the partner tiers; everyone meets the team. Both live inside the scroll story.

## Creative Director
- **Thesis.** Maia is the mother of Hermes, the god of speed: every millimetre of Hermes V1 is earned inside the rules.
- **Signature: object.** The real car, upright on its wheels, turned by scroll from first frame to last. It never comes
  apart (an exploded view was tried and cut at the team's request).
- **Signature moment (chapter 06).** The turntable: one long sweep round the car while the crest's dashed lines and
  four-point stars trace across it, labelled from the team's own engineering drawing. The Pleiades return behind it, Maia
  in gold.
- **Rejected:** exploded view (looked cheap); race-track fly-through (generic, no asset); kinetic type only (loses the car).
- **Not on the car:** a driver. The team's drawing labels halo, wings, pods and CO₂ parts, not a driver, so the dome in
  the cockpit is painted titanium and never named.

## Art Director
- **Palette (team scheme):** deep racing green `#193B25`, crisp racing white `#F4F6F5`, champagne gold `#C6AE7C`,
  matte charcoal `#1E201F`, warm titanium `#8C8982`.
- **Type:** Montserrat (portfolio covers) for display, Raleway (engineering pages) for body, JetBrains Mono for data.
- **Sky:** the Pleiades drawn like the crest: four-point stars, dashed lines, Maia in gold with a slow pulse.
- **Light:** warm key that follows the pointer, green rim, soft studio floor with a contact shadow.

## Story Architect: storyboard
One pinned stage, 11 chapters, 115lvh each on desktop (85lvh on phones). p runs 0→1 through the stage.

| # | Chapter | Car | Panel | Copy source |
|---|---------|-----|-------|-------------|
| 01 | Reveal | front ¾, nose right | Pleiades twinkle in | Why MAIA (myth) |
| 02 | Envelope | side profile | 208.54 / 72.51 / 38 mm count up | Rules and Regulations; Development Process (30 mm offset) |
| 03 | Front wing | low, nose-on, streamlines | — | CFD conclusions (Hermes V1); Rules (chord, thickness, span) |
| 04 | Side pods | low ¾ | — | Development Process (chassis) |
| 05 | Rear | rear ¾ | — | Rules (CO₂ chamber); CFD conclusions (rear pods) |
| 06 | Constellation | turntable sweep | crest lines + labels: front wing, side pod, halo, CO₂ canister chamber | Renders and Engineering Drawings |
| 07 | CFD | steps left | three models with forces and meters; Hermes V1 "Selected" | CFD pages |
| 08 | Team | small, high in frame | six member cards deal in | About our team; Roles and Responsibilities |
| 09 | Why MAIA | small, low right | the Pleiades glide to centre and grow | Why MAIA |
| 10 | Partners | steps left, nose to the tiers | four tiers, budget, charity line | Sponsorship and Marketing; Budgeting |
| 11 | Lights out | grid pose | five lights on then out; CTA to Partners / Team; sponsorship contact | Roles and Responsibilities |

## Motion Director
- Scroll is the only clock. Camera, car placement, sky and labels are functions of p, so scrolling back reverses.
- The camera only ever keeps turning: theta increases across the whole story (two full turns).
- Word-stagger headlines, cards deal in, meters grow; each block leaves as one tween.

## Creative Technologist
- `tools/build_car_glb.py`: STL → 17 named parts, Z-up → Y-up (asserted), angle-weighted crease normals baked in.
- anime.js v4: `onScroll` observer for progress; one `createTimeline` seeked to eased progress for every chapter.
- **Seek bug found and fixed:** a single seek that jumps clean over a tween left the earlier tween's value on screen
  (590 → 682 kept chapter 06 visible). The seek now walks in steps of ≤4 timeline units, and skips when nothing changed.
- The observer's own `sync` mode stalled after repeated jumps here, so the timeline is seeked directly.
- Reduced motion: camera holds the hero pose; the car dims behind the content chapters; nothing slides or twinkles.

## QA log
_Filled in after the QA run._
