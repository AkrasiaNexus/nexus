# Lore

A sidequest generator for friend hangouts in Abu Dhabi. Tell it how many people are out, when you have to be home and what you can spend. It picks a niche spot, gives you the real bus route there and back, and hands you a game to play when you arrive. Finished quests clear the fog on a map of your own city and land in a shared Lore Book.

**Live prototype:** https://claude.ai/artifact/LwNwhfV2J2aWaz7CTd35DH

## Why

Most hangouts end up in a mall because nobody knows where else to go, and growing up in one city makes it feel like there's nothing new. Existing "things to do" apps give you a pin on a map. They don't tell you whether a group of students can get there by bus, how long you'd actually have once you arrive, or what to do when you get there.

## What works now

- **Group size (1–8)** changes the fare totals, how many dares get dealt, and which games unlock. Team games need 4 or more.
- **Time window** ("out from" / "home by"). Every quest gets a timeline: bus there, time at the spot, bus home, with today's sunset marked. Spots that don't fit get filtered out.
- **Budget cap per person**, covering bus fare both ways, entry, food and game money.
- **10 verified spots**, each with real ITC bus lines, walking distance, and an optional taxi leg with the fare split per cab.
- **Vibe filter**: sunset, chaos, chill, edge, food.
- **Games:** NPC Dialogue (a deck of harmless stranger dares, one per person), the AED 5 Draft, Split Hunt (4+ people), and Cover Art (an album-cover group photo that becomes the Lore Book entry).
- **Boss Fights:** two-stop runs, for example markets before dusk followed by a 3.5 km walk to dinner.
- **All spots** browser, so you can pick a spot directly instead of rolling.
- **Fog-of-war map** and **Lore Book**, saved in the browser.

## How it works

One self-contained HTML file (`prototype.html`) with no build step and no dependencies apart from Google Fonts.

| Piece | Approach |
|---|---|
| Spot data | A `SPOTS` array: coordinates, route legs, minutes door to door, walking metres, tags, costs |
| Bus fare | Hafilat rule: AED 2 + 5 fils/km, capped at AED 5 per trip |
| Taxi fare | Abu Dhabi metered fare: AED 5 flag fall + AED 1.82/km, AED 12 minimum, 4 people per cab |
| Sunset | NOAA solar equations, computed for Abu Dhabi time |
| Planning | `planQuest` / `planBoss` fit travel and stay into the time window and reject plans under 45 minutes |
| Map | Canvas with an offscreen fog layer, cleared with radial gradients around explored spots |
| Storage | `localStorage` (try/catch guarded) for explored spots and Lore Book notes |

## Data sources

- Routes: Google Maps transit data for ITC buses, pulled 10 Nov 2026, all starting from Abu Dhabi Bus Station (Al Wahda).
- Fares: Abu Dhabi Mobility (admobility.gov.ae).
- Spot details: r/abudhabi, wow-abudhabi.com, digiflow.ae.
- New spots get added by a daily research job that verifies each route before adding it.

Every route currently starts at the bus station, and fares are estimates. Check a route the first time you take it.

## Run it

Open `prototype.html` in any modern browser.

## Roadmap

- [ ] Start from your own location instead of the bus station
- [ ] Shared Lore Book across a friend group (accounts + sync)
- [ ] Installable PWA for phones
- [ ] Photo upload for Cover Art
- [ ] More cities after Abu Dhabi

## Rules the app follows

- Public, legal spots only. No trespassing and no abandoned buildings.
- Dares never involve filming strangers, because UAE privacy law is strict.

## License

MIT. See [LICENSE](LICENSE).
