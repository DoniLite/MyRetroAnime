# MyRetroAnime: roadmap

## Goal

A personal, yearly retrospective of the anime the owner watched: each year is a **giga season** with its own immersive universe, updated daily through the year and kept online year after year. The site should feel like a piece of art you travel through, not a list: every anime is a moment to revisit, with notes, scenes and explanations, in French and English.

## Status (November 2026)

Live at https://myretroanime.donilite.me (GitHub Pages, deployed from `main`).

Done:

- Content pipeline: 17 anime of 2026 scaffolded from the MAL API (15 visible, 2 planned). No scores or texts written yet.
- Shared site: bilingual routes, hall, year line, anime pages, entry dialog, spoilers switch, trailer facade.
- 2026 Seasons Line in 3D: realistic landscape, seasonal vegetation and particles, river, station platforms, season titles in the landscape, loading lock, mobile framing. See [DESIGN.md](DESIGN.md).

## Next

The owner wants the whole site's look and experience finished before any content is written.

0. **Loading on slow connections**: done. No more 2D fallback while bytes arrive, a progress train, assets halved ([specs/loading.md](specs/loading.md)). Next: measure on a real phone on a slow network.
1. **One continuous journey** (hall → ride in the train → line → station, no page reloads, level crossings, window frame, horizon depth). Spec to review before shipping: [specs/one-world.md](specs/one-world.md).
   **Hall** (`/{lang}/`): first version done (platform, dive into the valley, season shrines with anime props). Next: more life in the scene (lit train windows, lamps flicker, birds), real-phone performance.
2. **Entry dialog redesign** to match the scene (it still uses the first visual pass).
3. **Terminus:** a last stop recapping the year (top picks, stats from `meta.json`, closing words).
4. **MDX components:** `<Moment>`, `<Gallery>`, `<Clip>`, `<Explain>`.
5. **Performance on real phones:** measure, then add adaptive quality (fewer trees and grass, lower resolution, simpler far trees) if needed.
6. **Write the content** (including the hall's season lines in `src/years/2026/index.ts`, drafted by the agent; scores, criteria, FR/EN texts from each `notes.md`), once the experience is done.

Backlog: line mini-map, outside camera shots on season transitions, ambient sound (off by default), reading mode toggle, import from the owner's MAL list.

Out of scope: visitor comments, analytics, CMS, OST excerpts.

## Decisions the owner made (keep them)

- **Realistic matte painting**, not low-poly or flat illustration: realistic textures, generated ez-tree trees, aerial haze. Composition follows a landscape painting: framed valleys opening at each stop, layered ranges, one river.
- **The particles** (snow, petals, fireflies, leaves) are loved: keep them as they are.
- **No anime image in the sky.** It was tried (full-sky key visual with a reveal) and removed: the station board, card and entry already carry the anime.
- **Season titles live in the landscape**, plain light text without shadow or extrusion, close enough to read, with a tree or two overlapping it. Readability beats integration.
- **Only one water body**, the river: stray ponds read as bugs.
- **No flash on load:** the visitor never sees the raw 2D page or a half-loaded scene, and cannot scroll until everything is loaded.
- **Content:** the owner writes raw notes; the agent drafts both FR and EN from them for review.
