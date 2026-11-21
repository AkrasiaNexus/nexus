# Majlis handoff (parked)

**What it is:** it finds the fairest place for a group to meet by public transport. It runs a RAPTOR journey planner from each person and ranks meeting stops by the longest trip, then by total time, and it's checked against a brute-force connection-scan planner.
**Folder:** `majlis/` (`src/raptor.js`, `src/csa.js`, `src/gtfs.js`, `src/meet.js`, CLI `bin/majlis.js`, benchmark `bench/`).
**Tests:** `cd majlis && npm test` passes 20/20, including differential tests against the connection-scan planner.
**Live explainer:** https://claude.ai/artifact/XAXpwyvNBP4PGY9mejhmwR (source `majlis/explainer/`).

**Open items:**
- The real Abu Dhabi GTFS feed was never downloaded, because the sandbox couldn't reach the host. Find the feed URL and ask the user before adding a network host.
- Fares (AED 2 + 5 fils per km, capped at AED 5).
- An "everyone arrives within 10 minutes" constraint.
- A spatial index for scoring candidate stops.
- Multi-criteria RAPTOR.
- A browser "meet in the middle" mode for Lore.
