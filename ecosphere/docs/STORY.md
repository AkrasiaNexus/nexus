# EcoSphere AI landing: story doc

**Thesis.** Everyday actions become measurable impact, and one phone is all it takes.
**Signature.** Object: a CSS-3D smartphone (rejected: a growing tree world, too generic; kinetic type only, loses the product).
**Signature moment.** Chapter 04: the phone turns to its camera, scans a bottle, and swings back to show the result.
**World.** App tokens: ink #0b0d0c, forest #1e3a28, leaf #a2d47e; Opal-dark negative space; one green light source behind the phone.

| # | Chapter | Track | Phone | Screen | Copy | Motion beats | Mobile |
|---|---------|-------|-------|--------|------|--------------|--------|
| 01 | Intro | 0–10% | rises from dark, tilt → level, edges light | off → logo | Technology for a greener tomorrow. | glow bloom, screen power-on | phone smaller, copy below |
| 02 | Wake | 10–20% | slight turn | welcome → dashboard | Everything you need to make a difference. | welcome stagger, zoom-through swap | same |
| 03 | Dashboard | 20–30% | steps right | home: leaf, stats | Your everyday actions. A measurable impact. | vein growth, count-ups, particles, progress chip | no chip |
| 04 | Scanner | 30–40% | rotateY 160→185→360 | swapped while facing away → result | Meet your AI-powered waste assistant. | bottle in, beam sweep, outline draw, tag, result + confidence | bottle above phone |
| 05 | Stats | 40–50% | front | stats | Turn environmental action into measurable impact. | ticks light, line draws, bars grow, panel expands out and back | panel in front |
| 06 | Market | 50–60% | slight tilt | market | Give useful things a second life. | cards deal, one expands, donation token travels, shelf restocks | same |
| 07 | Rewards | 60–70% | front | rewards | Make every positive action count. | EC count, badges pop, unlock burst, avatar change | same |
| 08 | Roles | 70–80% | steps aside | 6 role dashboards | One platform. Different perspectives. One shared mission. | crossfades + role label highlight | phone higher/smaller |
| 09 | Impact | 80–90% | recedes to 0.5 | admin | Small actions. Collective change. | leaves grow in, glow widens | phone top |
| 10 | CTA | 90–100% | returns | admin | Let's make sustainability part of everyday life. | logo lands, buttons go live (inert until then) | stacked buttons |

**QA (2026-11-17).** Consistency: all consistent (6 targets). Functional: 17/17 (nav, CTA inert/live, footer, reduced motion 10/10 chapters + phone still, resize keeps chapter, 0 console errors). Perf: about 59fps headless, 0–3 long tasks. App E2E: 29 pages × 4 roles OK.

**Jury self-score.**
- Design 7.5: strong world and restraint; phone screens are small at desktop size.
- Usability 8: mobile layout designed; reduced motion complete; CTA clear.
- Creativity 7.5: the flip-to-scan is original for the category.
- Content 7: real app UI and labelled demo data; no real photography.
- **Done after review:** cursor-reactive phone tilt (createAnimatable layer over the scroll rig), flush edge slabs, softened scan beam.
- **Also done:** generative sound (opt-in nav toggle: breathing pad + pentatonic chapter chimes, WebAudio, no files).
- **Next fixes for a higher score:** real product photography in the marketplace screen.
