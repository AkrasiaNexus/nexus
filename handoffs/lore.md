# Lore handoff

## Goal (user's words)
"turns friend hangouts into quests": a niche, cheap spot, a real bus route and games, inside a 4–5pm to 10:30pm window, starting with Abu Dhabi. The user wants niche, chill, slightly edgy spots, "not allat basic tourist bs", nothing far ("al wathba and all is way too far").

## State on 21 Nov 2026
- **49 spots** in `lore/prototype.html` (`SPOTS` array):
  - 10 originals from 10 Nov
  - 9 added by the daily spot task directly to the live page, merged into the repo on 20 Nov
  - 30 added on 20 Nov (the block after the comment `// Added 20 Nov 2026`, written as JSON-style objects)
- **Travel modes:** 38 spots by bus, 8 taxi-only (`legs: []` with `taxi`), 3 on foot from the station (`legs: []`, `km: 0`).
- **Bosses:** 5 (march, supper, double, lateshift, cooldown).
- **Games:** NPC Dialogue (stranger dares), the AED 5 Draft, Split Hunt, Cover Art.
- **Live page:** https://claude.ai/artifact/LwNwhfV2J2aWaz7CTd35DH (version 15), published from `lore/prototype.html`. It's private; the user shares it from the Share menu.
- **Tests:** `cd lore && npm test` passes 11/11 (Playwright in Node: data integrity, fares, the taxi and walk split, day labels, sunset, planner curfews, Campfire sync, PWA offline). **Build:** `npm run build` writes the installable app to `dist/`.

## The user's rules for Lore (also in CLAUDE.md)
- **Never delete or edit existing spots.** Only add.
- **No trespassing and no abandoned buildings** (UAE legal risk). Find legal edgy spots instead.
- **Games:** keep NPC Dialogue, Cover Art (the user finds the old name "main character shot" corny) and Boss Fight. Bus Roulette was rejected.
- **Spot vibes allowed:** sunset, chaos, chill, edge, food.

## How the 30 new spots were researched (reuse this method)
1. **Ideas:** Time Out Abu Dhabi, Visit Abu Dhabi, wow-abudhabi.com, and r/abudhabi via Firecrawl's Alexandria provider `anyapi` / `reddit/subreddit-search` (Reddit blocks the server IP directly).
2. **Hours and prices:** one Firecrawl search per spot, with venue pages preferred.
3. **Bus lines:**
   - The lines serving Abu Dhabi Bus Station come from its Moovit stop pages (`moovitapp.com/index/en/public_transit-Abu_Dhabi_Bus_Station-...-stop_25132990-3824`).
   - The order of stops comes from Moovit line pages, e.g. `public_transit-line-56-Dubai_Abu_Dhabi-3824-864210-428105-0` and `-1` for each direction.
   - Lines confirmed from the station: 34 (to Emirates Palace via the Corniche), 54, 56 (New Mina Souq ↔ Khalifa Park), 102 (Mushrif, Zayed Sports City, the Grand Mosque), 5 and N2.
4. **Coordinates:** OpenStreetMap Nominatim, scraped through Firecrawl (`nominatim.openstreetmap.org/search?q=...&format=json`).
5. **Road distance (`km`):** the OSRM table API from the bus station (54.3776, 24.4717), through Firecrawl.
6. **`dur` is an estimate:** 6 min wait + about 1 min per stop + walking at 80 m/min. Taxi minutes are OSRM drive time × 1.3.

## Dead ends
- Google Maps transit through Firecrawl fails with a tunnel error.
- Reddit is blocked by direct scrape, curl and Playwright alike (403 "blocked by network security").
- Line 401 goes toward Al Wathba, not Saadiyat. Line 56 does **not** go to Saadiyat, although Moovit's place pages list it nearby. Yas is served only by line 218, which doesn't start at the station.

## Open items
- **The user is reviewing each spot.** Expect feedback per spot. Changes the user asks for are fine, but never delete without the user saying so.
- **The daily spot task publishes to the live page directly, not the repo.** Next time, read the artifact, merge the new spots into `lore/prototype.html`, and republish. The 20 Nov merge is the model to follow.
- **Lead:** live spot `marafi` uses line **120** "toward Al Saadiyat Public Beach" from the bus station. If that checks out, the Saadiyat spots (`saadiyat`, `mamsha`) could get a real bus leg instead of taxi-only.
- **Trip times** for the new spots are estimates and untested in real life. The TrainYAS (Mon/Wed) and Masdar details come from social posts and listings.
- **The Public Art Biennial** spot (`minaart`) is only true until 15 Feb 2027. The app has no expiry field.
- **Majlis** (the fair-meeting-point router) could later power a "meet in the middle" mode.
