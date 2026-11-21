# Campfire handoff (parked)

**What it is:** serverless sync for a small group's shared journal. It's a state-based CRDT (a last-writer-wins register per entry, a grow-only set of explored places and a Lamport clock). Friends sync by pasting a `CF1.<deflate+base64url>.<crc32>` code into the group chat.
**Folder:** `campfire/` (`src/`, `tools/bundle.js`).
**Tests:** `cd campfire && npm test` passes 19/19 (merge laws, decode validation, zip-bomb and size limits, refusing to rewrite existing entries).

**Used by Lore:** it's bundled into `lore/prototype.html` between the `/* campfire:start */` and `/* campfire:end */` markers by `node campfire/tools/bundle.js lore/prototype.html`.
- Never hand-edit that block.
- After changing Campfire, rebundle and run Lore's tests too (`cd lore && npm test`).

**Open items:** nothing is urgent. Possible next steps are QR-code sharing and a size check on books with hundreds of entries.
