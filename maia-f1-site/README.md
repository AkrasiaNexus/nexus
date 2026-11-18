# Team MAIA Racing — scroll-driven car deconstruction

A scroll-scrubbed website. The F1 in Schools car (from the regulated no-go zone STL) splits into named parts as you scroll: front wing, halo and cockpit, sidepods and floor, rear wing and flap, a full exploded blueprint, team, telemetry, and a starting-lights finish.

No build step. Plain ES modules, Three.js and anime.js loaded from pinned CDN versions.

## Run it

Modules need an HTTP server (not `file://`):

```bash
cd maia-f1-site
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Layout, chapter copy, nav, team portal stub |
| `css/site.css` | Styles, layout, phone breakpoints, reduced-motion rules |
| `js/main.js` | Boot, scroll tracking, callouts, hotspots, drag-to-orbit |
| `js/timeline.js` | anime.js timeline: camera shots, explode sets, text reveals, telemetry draw-on, start lights |
| `js/scene.js` | Three.js scene: GLB load, named parts, explode vectors, lights, streamlines, blueprint edges |
| `js/content.js` | Callouts, engineering notes, roster placeholders, telemetry series |
| `assets/car.glb` | Car mesh split into 17 named parts (mm, Y-up) |
| `tools/build_car_glb.py` | Rebuilds `car.glb` from the STL |

## Edit the content

- Chapter headlines and body copy: `index.html`, inside `.chapter` blocks.
- Callouts, engineering notes (shown on the blueprint chapter): `js/content.js`, `CALLOUTS`.
- Team roster: `js/content.js`, `ROSTER`. The cards say "Name TBC" until real names are added.
- Telemetry: `js/content.js`, `TELEMETRY`. The series are **illustrative**; replace them with real run logs.
- Camera shots and explode timing: `js/timeline.js`, `SHOTS`.

## Rebuild the car model

```bash
python3 tools/build_car_glb.py path/to/no_go_zone.stl assets/car.glb
```

The split is rule-based. The STL is one fused body for the chassis, so its parts come from triangle position, not the original CAD tree. The script refuses to run if the connected-body sizes change, so the rules can be re-tuned for a different file.

## Known limits

- The chassis parts (monocoque, cockpit, sidepods, floor, nose) are cut by position. Their seams show as open edges in the blueprint chapter. A part-level STEP or STL export from CAD would remove that.
- Telemetry data and the roster are placeholders.
- The team portal link goes to a stub section. There is no backend.
- Needs WebGL. Reduced-motion users get stepped chapter poses instead of a scrub.
