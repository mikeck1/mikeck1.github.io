# ThisClose

ThisClose is a free pass-and-play party game for families and friends, by Team Walter Games.

One player, the Clue Giver, sees a secret spot on a bar between two opposites (like *Cold* and *Hot*) and gives a one-word clue. Their team slides a marker to where they think the clue lands. The closer they get, the more points they score.

Play it at https://mikeck1.github.io/

## Run it locally

It's a static site with no build step:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. The service worker is disabled on localhost so edits show up on refresh.

## Files

- `index.html`, `style.css`, `script.js`: the game
- `clues.json`: the default card deck
- `sw.js`: offline support (bump `CACHE_NAME` when the precache list changes)
- `about.html`, `terms.html`, `privacy.html`, `changelog.html`: site pages

---

ThisClose™ © 2026 Team Walter Games. All rights reserved.
