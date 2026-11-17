# Pattern catalogue: Art + Motion Director

Pick patterns that serve the storyboard. Use 4–6 per site, plus the one signature moment. "Random effects" is the #1 juror penalty.

## Structural
- **Pinned stage + master timeline** (default). Tall track, sticky 100svh stage; every element on the stage is driven by one scroll-scrubbed timeline. Reversible by construction. *(EcoSphere landing)*
- **Step stack.** Each step is a ~200lvh wrapper with a `position:fixed` inner that a per-step progress drives. Good for kinetic type. *(Codrops "Do not scroll")*
- **Stacked small scenes.** Several light canvases/scenes instead of one giant world; this is what survives mid-range Android. *(Immersive Garden: 12 small canvases)*
- **Loop.** The last scene morphs back into the first; only with seamless transitions. *(IVRESS)*

## Signature-object moves
- **Rise from darkness.** Object starts low, tilted (rotateX ~24°, rotateZ −6°), dim; lifts to centre while a glow blooms behind it; then "powers on".
- **Turn to reveal.** rotateY 0→180 shows the back (needs real front/back faces). Swap the screen content while it faces away, then rotate to 360 to land on the new state. *(phone → camera → scan)*
- **Step aside.** Object slides to make room for copy (x ±15vw), then recentres for climaxes.
- **Recede into the world.** Scale to ~0.5, the environment grows in around it; then return for the CTA.
- **Expand out of the frame.** A UI element grows from the object's screen to a larger floating panel, then retracts.

## Content reveals
- **Word-stagger headline.** Split into words, opacity/y stagger ~12ms of timeline per word, key words tint to the accent afterwards.
- **Number count-up.** Animate a plain object `{v}` and write `textContent` in `onUpdate`; use tabular numerals.
- **Line draw.** `pathLength=1`, `stroke-dasharray:1 1`, animate `strokeDashoffset 1→0`. (Don't combine with `vector-effect: non-scaling-stroke`; use a clip-path reveal instead.)
- **Tick bezel / ring fill.** N short ticks lit in sequence; brighter at the leading edge; quarter notches longer.
- **Bar grow.** `scaleY 0→1` from `transform-origin: bottom` with stagger.
- **Organic growth.** Veins/branches filling along their length (EcoSphere leaf: `veinFill(g, vein)`).
- **Mask/clip reveals.** `clip-path: inset()` or SVG masks (grid/blind patterns) for scene changes. *(Codrops SVG mask transitions)*
- **Card deal + focus.** Cards stagger in, one scales up to centre stage, returns; the shelf slides to the next set.

## Atmosphere
- **Object leans toward the cursor** (±6–9°) on a separate tilt layer: the hook is alive before the first scroll.
- **Light that follows the cursor.** A page-level radial glow at the pointer plus a card sheen and edge catch (mask-composite border). Fine pointers only.
- **Depth of field.** Background shapes at mixed blur/opacity, so 2D layers feel spatial.
- **Particles with purpose.** A few motes drifting off the signature at an emotional beat; never ambient confetti.
- **Sound (opt-in).** Either a gate ("Enter / Enter without audio", as on Unseen and Igloo) or a nav toggle, off by default. No asset budget? Synthesize it with WebAudio: a breathing low pad (2–3 detuned sines through a lowpass with a 0.07Hz LFO on cutoff, gain ~0.05, 2.5s fade-in) plus a soft triangle chime per chapter from a pentatonic scale, fired from the timeline's chapter-change callback. *(EcoSphere `landing/ambient.ts`)*

## Easing language
- Default `inOut(2)`; reveals `out(3)`; counters `out(3)`; nothing linear except scanning beams.
- For read-pauses, use an ease that is fast–slow–fast (GSAP `slow(0.25,0.95)`; in Anime, chain tweens or use a custom cubic).
- Overlap tweens: secondary motion starts before the primary ends. Sequential blocks feel like slides.
- Anticipation before big moves (a small counter-motion), as in Disney's principles.

## What to avoid
Everything floating at once; the same entrance on every element; a horizontal gallery because it's trendy; glass/blur as decoration; neon glows; emoji as icons; ten cards in a grid; long loaders (2s branded reveal is craft, 6s is a penalty).

## Reference sites (study the mechanism, never copy the look)
animejs.com (engine showcase: scroll sync, stagger, SVG draw) · igloo.inc (material + scroll camera) · lusion.co (reacts in the first second) · landonorris.com (one hero object, editorial rest) · persepolis.getty.edu (scroll as a walk) · unseen.co (sound gate, drag) · immersive-g.com (stacked scenes) · ponpon-mania.com (2D + physics, no 3D needed) · why.zero.university (mechanics restate the thesis) · tympanus.net/codrops/tag/scroll (technique tutorials).
