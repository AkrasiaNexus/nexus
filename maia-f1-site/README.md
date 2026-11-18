# Hermes V1 · Team MAIA Racing

One scroll-driven story: the team's car turns through 11 chapters (envelope, front wing, side pods, rear, the
constellation turntable, CFD iterations, the team, Why MAIA, partner tiers, lights out) under the Pleiades, with Maia in gold.

Every fact comes from the team's Enterprise and Engineering portfolios. The story plan is in `docs/STORY.md`.

No build step: plain ES modules, Three.js and anime.js from pinned CDN versions.

## Run it

```bash
cd maia-f1-site
python3 -m http.server 8000
```

Open http://localhost:8000 (modules need a server, not `file://`).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The stage, the 11 chapters' copy, nav |
| `css/site.css` | Team palette and type, chapter layouts, phone layout, reduced motion |
| `js/main.js` | Boot, panels, eased scroll, sky focus, nav jumps, CTA gating, resize |
| `js/story.js` | Chapter list, camera keys, and the anime.js timeline for all copy and panels |
| `js/scene.js` | Three.js: the car, paints, studio floor, airflow lines |
| `js/sky.js` | The Pleiades, from catalogue positions, Maia highlighted |
| `js/overlay.js` | The constellation labels drawn over the turning car |
| `js/content.js` | Team, CFD results, regulation numbers, partner tiers (from the portfolios) |
| `assets/car.glb` | The car, 17 named parts, normals baked |
| `tools/build_car_glb.py` | Rebuilds `car.glb` from the STL |
| `qa/` | Playwright scripts: frames, consistency, functional, perf, record |

## Edit

- Copy and chapter headlines: `index.html`. Team, CFD, tiers: `js/content.js`.
- Camera and car placement per chapter: `KEYS` in `js/story.js`.

## Rebuild the car

```bash
python3 tools/build_car_glb.py path/to/no_go_zone.stl assets/car.glb
```

The STL fuses the chassis into one body, so its parts are cut by position. The script checks body sizes, the axis swap
(the car must come out upright) and that the wheels touch Y=0.

## Test

Serve the site on port 8000 or 8800, then:

```bash
URL=http://127.0.0.1:8800/ node qa/functional.cjs
```

```bash
URL=http://127.0.0.1:8800/ node qa/consistency.cjs
```

```bash
URL=http://127.0.0.1:8800/ MODE=m OUT=qa/out node qa/frames.cjs
```

## Known limits

- The cockpit dome is shown but not named; the team's drawing does not label it.
- No team photos: the portfolio photos are of students and the page is publicly shareable, so they are left out until the team decides.
- Headless QA renders WebGL in software (about 4 fps); real GPUs run far faster.
