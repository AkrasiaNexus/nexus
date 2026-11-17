# Engineering: Creative Technologist

## Choose the engine (lightest that serves the art direction)
| Need | Use |
|------|-----|
| Simple reveals/parallax tied to scroll, no JS | **CSS scroll-driven animations**: `animation-timeline: view()` / `scroll()`. Baseline since Oct 2026 (Chrome 115, Firefox 159, Safari 26). |
| A choreographed, pinned, multi-chapter story | **Anime.js v4** `createTimeline` + `onScroll` (+ `createScope` for responsive). ~27 KB, modular. Default here. |
| Project already on GSAP, or needs SplitText/Flip/Physics2D | GSAP + ScrollTrigger (+ Lenis). Don't install both engines without a reason. |
| Real 3D world/material (ice, cloth, terrain) | Three.js (WebGL/WebGPU), Draco/Meshopt + KTX2, DPR cap 2, lazy-load the module. Keep the copy in real HTML (SEO). |
| Photoreal product spin with no live 3D | Image sequence on `<canvas>`: staged preload, about 25px+ of scroll per frame, a smaller frame set for phones, a still for reduced motion. |
| 3D-ish UI object (phone, card, box) | **CSS 3D**: real front/back faces + edge slabs, `preserve-3d`, `backface-visibility:hidden`. Cheap and crisp. *(EcoSphere phone)* |

Always check the installed version's own `.d.ts`/source before writing API calls. Don't trust memory.

## Anime.js v4 facts (verified in node_modules/animejs 4.5.0)
- `onScroll({ target, enter, leave, sync })`. `enter`/`leave` strings are **"<container> <target>"**, so `enter:'top top', leave:'bottom bottom'` maps exactly onto a pinned track.
- `sync: true` = direct scrub; **`sync: <1` number** = smoothed lerp (`lerp(.01,.2,n)` per frame, so 0.5 feels inertial); a string = an easing.
- Function values: `(target?, index?, targets?) => value`. Type them as `(_?: unknown, i = 0) => ...` to satisfy `FunctionValue`.
- Callbacks: `onUpdate` on the timeline (progress is `self.progress`) and on tweens (fires while scrubbing, both directions). Use it for counters and SVG attributes.
- `createScope({ root, mediaQueries:{ mobile:'(max-width: 767px)', reduce:'(prefers-reduced-motion: reduce)' } }).add(self => { …; return () => tl.revert() })`. It rebuilds on media change; `self.matches.mobile`.
- Individual transforms: `x, y, scale, rotateX/Y/Z`, with `'vw'/'vh'` strings allowed. `translate:` CSS on the same element still composes.

## Master timeline architecture
```ts
const C = 1000;                       // one chapter of timeline time
const at = (ch, f = 0) => ch * C + f * C;
const tl = createTimeline({ defaults:{ ease:'inOut(2)', duration:C*.4 },
  autoplay: onScroll({ target: track, enter:'top top', leave:'bottom bottom', sync:.5 }),
  onUpdate: self => { cta.toggleAttribute('inert', self.progress < .93) } });
pose(ch, frac, {x,y,scale,rotateY…})  // signature object, skipped entirely when reduce
swap(fromScreen, toScreen, t)         // crossfade inside the same object
tl.add({}, { duration:1 }, at(N))     // pin the end so the last chapter has room
```
- Mark initial states in markup (`style={{opacity:0}}`) to match tween `from` values: no flash before hydration.
- Chapter text: reveal per word (stagger), but **fade the block out as ONE tween**. Staggered per-word fade-outs failed to render their final frame on fast scroll jumps (the bug was reproduced and fixed here).
- Swap screen content while the object faces away (rotateY ~180) so the change is never seen.
- Keep a `data-*` hook API between scene markup and the timeline (`data-count`, `data-draw`, `data-bar`, `data-tick`, `data-scr`).

## Traps this repo already hit (don't repeat)
1. **`filter` (e.g. drop-shadow) on a `preserve-3d` element flattens it**, so back faces show a mirrored front. Put the shadow on a sibling element.
2. **A transformed ancestor (page transition wrapper) re-parents `position:fixed`** children, so floating UI lands mid-page. Render it with a React portal to `document.body`.
3. **Resizing across a breakpoint changes the track height**, so the same scrollY becomes a different chapter. Record story progress (0–1) on scroll while the width is stable; on scope rebuild, `scrollTo(top + progress*(trackH - vh))`.
4. **Invisible CTAs still take clicks.** Toggle `pointer-events` + `inert` from timeline progress.
5. **`dvh` resizes as the mobile toolbar moves**, so pinned scenes jump. Use `100svh` for the stage (`lvh` for step heights).
6. **Next 14 can't bundle onnxruntime-web / some ESM-heavy libs**: load them at runtime with `import(/* webpackIgnore: true */ url)` from a pinned CDN version, keep the npm package as a devDependency for types.
7. **Dash animations break with `vector-effect: non-scaling-stroke`**: reveal lines with a `clip-path: inset(0 100% 0 0)` keyframe.
8. **Edge slabs for CSS-3D thickness:** `transform-origin` on the body's edge, then `rotateY(90deg) translateX(-depth/2)` (no leading translate), or the slab floats half its depth away from the body.
9. **Cursor reaction without fighting the timeline:** wrap the object in a `[data-tilt]` layer (`transform-style: preserve-3d`) and drive it with `createAnimatable(el, { rotateX: 900, rotateY: 900, ease: 'out(3)' })` inside the same scope; fine pointers only, skipped for reduced motion. The timeline keeps owning the outer rig.
10. **Light beams/gradients with hard ends** look cheap: fade both ends with `mask-image: linear-gradient(90deg, transparent, #000 25%, #000 75%, transparent)`.
11. **`session.user` from supabase `getSession()` on the server logs warnings**: only test the session's existence in middleware.

## Performance budget
LCP < 1.5–2.5s · CLS < 0.05 · INP < 100ms · 60fps on a mid-range phone · page < 3MB.
Animate transform/opacity (plus filter/clip-path sparingly). One animation clock. Heavy modules lazy, behind a designed 1–2s reveal.
Cap DPR at 2 for canvas/WebGL. Pause offscreen WebGL. Measure, don't guess: see qa.md perf script.

## Reduced motion (required)
Same timeline, no spatial motion: the signature stays still; content crossfades in place; text still reveals (opacity only); decorative particles off.
Test that every chapter's text becomes visible and the object's transform never changes.
