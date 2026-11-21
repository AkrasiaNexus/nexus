# Art direction: Art Director

Design is 40% of an Awwwards score: typography, layout, colour, hierarchy, consistency, micro-details. Start from the project's existing brand; never invent a new identity.

## Typography (the biggest lever)
- **One display face with character + one quiet text face** (or one superfamily). Big type does the design work: a professional face beats a familiar free one (Codrops kinetic-type author starts at Pangram Pangram).
- **Display sizes are fluid, body sizes are stepped.** `font-size: clamp(2rem, 3.6vw + 1rem, 3.5rem)`. Keep a `rem` term in the preferred value so browser zoom still works; pure `vw` breaks zoom (accessibility).
- Modular scale for steps (ratio 1.25–1.333); tracking −0.02 to −0.04em on display; `text-wrap: balance` on headlines; body 65–75ch.
- **Tabular numerals** for anything that counts (`font-variant-numeric: tabular-nums`).
- Kinetic type rules: animate a few words at the pace you'd read them aloud; give a read-pause in the middle (fast–slow–fast ease); scale letters around the word's centre, not their own. Keep real HTML text for screen readers.

## Colour and light
- Pick the palette from the brand; one **accent** used sparingly for key words and the CTA. Dark worlds: almost-black ink, not #000; never neon.
- **One light source** in the scene (a glow behind the signature) and keep it consistent; shadows have an offset and blur.
- Colour can progress with the story (dark → lit, cool → warm) as a chapter signal.
- Theme the browser surfaces too: `::selection`, focus rings, caret, scrollbar.

## Texture, icons, imagery
- Subtle texture (dot grids, grain) beats gradients-for-decoration. Glass/blur only when it means something.
- Icons are drawn in one stroke family; **no emoji as icons** (the user calls it "AI slop").
- Real product UI/photography; demo values say "demo". Characters/avatars: varied, ownable (see EcoSphere Critter).

## Layout and space
- Generous negative space ("ma"): restraint reads as expensive. One idea per screen.
- Copy column + signature on desktop; on mobile, signature on top and copy below (never a shrunken desktop).
- Size the stage with `100svh`; avoid `dvh` on pinned scenes.

## Touch equivalents (decide at concept time)
- Cursor-reactive motion → on touch, nothing by default. A gyroscope tilt needs **`DeviceOrientationEvent.requestPermission()` from a tap** (iOS Safari 14.5+, Chrome 152+), so offer it as an opt-in ("tilt to explore") or skip it.
- Hover reveals → tap or always-visible on touch.

## Transitions into the product
- Landing → app: same-document `document.startViewTransition()` around client navigation (Next.js), or cross-document `@view-transition { navigation: auto; }` for MPAs (Chrome 126+, Safari 18.2+, not Firefox). Same-origin only; treat it as progressive enhancement.
