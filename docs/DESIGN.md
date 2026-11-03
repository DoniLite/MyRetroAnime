# MyRetroAnime: design

A yearly, personal look back at the anime I watched. Each year is a **giga season**, split into the four MAL anime seasons (winter, spring, summer, fall). Static site, no backend, hosted on GitHub Pages at `myretroanime.donilite.me`.

## Principles

- **Static only.** Astro builds plain HTML; 3D is layered on top as React Three Fiber islands. No server, no database.
- **Years never mix.** Each giga season has its own content folder and its own visual identity. Shared code knows nothing about a specific year.
- **Readable first.** Every page is complete, readable HTML. The 3D experience enhances it and never replaces it.
- **Bilingual.** Site in English and French. Code, comments and docs in English.

## Repository layout

```
src/
  content/<year>/<slug>/   one folder per anime (see "Content model")
  years/<year>/index.ts    the year's identity: line name, tagline, theme tokens
  years/<year>/Scene.tsx   the year's 3D layer (see "The 2026 experience")
  years/index.ts           registry of giga seasons, read through import.meta.glob
  lib/                     shared logic: seasons, i18n, Jikan, anime loading
  components/              shared UI (header, entry, trailer facade, spoilers)
  pages/                   routes
scripts/                   new.ts (scaffold anime), sync-jikan.ts (refresh cache), trees.ts (generate 2026 tree models)
public/models|textures/<year>/   the year's 3D assets, each folder with its LICENSE.md
```

Adding a year = adding `src/years/<year>/index.ts`. Content in a year folder without a matching year module fails the build.

## Routes

| URL                      | Page                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                      | Picks the saved language, then the browser language, then English, and redirects (client-side, Pages has no server redirects).                  |
| `/{lang}/`               | The hall: a departures board listing every giga season. The current year is "at platform".                                                      |
| `/{lang}/{year}/`        | The year's line: one scroll-snapped screen per stop (intro, season titles, stations).                                                           |
| `/{lang}/{year}/{slug}/` | One anime. Pre-rendered so links get real previews and SEO. Renders the same line, scrolled to that station, with its entry open in the dialog. |

## Content model

```
src/content/2026/sousou-no-frieren-2nd-season/
  meta.json    shared data (both languages)
  jikan.json   cached MAL metadata, written by the scripts, committed
  notes.md     raw notes, never rendered (still public on GitHub)
  en.mdx       English text   (optional, frontmatter: pitch)
  fr.mdx       French text    (optional, frontmatter: pitch)
  *.webp       images, optimized by Astro
```

`meta.json`:

| Field             | Meaning                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `malId`           | MyAnimeList id.                                                                                                                            |
| `status`          | `finished`, `watching` or `planned`. Planned anime are not shown.                                                                          |
| `season`          | Where the anime sits on the line: the season **I finished it in** (required unless planned). Defaults to the season it finished airing in. |
| `episodesWatched` | Progress badge for `watching`.                                                                                                             |
| `score`           | Global score out of 10, or `null` ("score coming"; excluded from stats). Not an average of the criteria.                                   |
| `criteria`        | Free, per-anime criteria: `{ "label": { "en", "fr" }, "score" }`.                                                                          |
| `overrides`       | Any `jikan.json` field to correct by hand (e.g. a missing trailer id).                                                                     |

Rules:

- **Aired elsewhere.** If an anime started airing in another season than where it sits, it gets an "aired Fall 2025" badge.
- **Text fallback.** If a language file is missing, the other one is shown with a "not yet translated" notice.
- **Pitch.** Short hand-written pitch per language. Without one, English pages fall back to the Jikan synopsis; French pages show nothing rather than English text.
- **Titles.** Romaji as the main title, Japanese title below.

## Daily workflow

1. `bun run new <mal-url>...` scaffolds folders (`--status watching --ep 3`, `--season fall`, `--year 2026`).
2. Dump raw thoughts in `notes.md`; turn them into `en.mdx` and `fr.mdx`.
3. Push to `main`. The workflow lints, tests, builds and deploys.
4. `bun run sync` refreshes every `jikan.json` (episodes and trailers change while a show airs). A failed fetch keeps the old cache.

Metadata comes from the official MAL API when `MAL_CLIENT_ID` is set in `.env` (git-ignored; the newest MAL video becomes the trailer), and from Jikan otherwise. Both produce the same `jikan.json`. The build never calls either API, so an outage never blocks a deploy.

## MDX components

Available now: `<Spoiler>` (hidden until clicked; a global "show all spoilers" switch is remembered per browser).

Planned: `<Moment>` (key scene: image, episode, timestamp), `<Gallery>`, `<Clip>` (short MP4/WebM, ~3 MB max; longer goes to YouTube), `<Explain>` ("the detail you may have missed").

## The year line (shared, `src/components/YearLine.astro`)

- **Stops.** Intro, then for each season a season stop followed by its stations. Stop _i_ is scroll screen _i_, both in the HTML and in the 3D scene (the `Stop[]` passed to `SceneProps`).
- **3D or 2D.** An inline script decides before first paint: WebGL 2 and no `prefers-reduced-motion` adds `has-3d` and `scene-loading` to `<html>`. `YearScene.tsx` then lazy-loads `src/years/<year>/Scene.tsx` (one chunk per year) and falls back to 2D only if that fails.
- **Loading.** While `scene-loading` is set, scrolling is locked (wheel via `overflow: hidden`, keys and touch via listeners) and the canvas is invisible. The scene calls `onReady` once three's `DefaultLoadingManager` has drained (20 s timeout) and two frames have rendered; the canvas then fades in.
- **3D mode.** Every stop is one viewport with scroll snapping; only the active stop's HTML is shown, fixed over the scene: the intro title, the station card bottom-left. Season headings are visually hidden: the scene writes the season into the landscape.
- **Entries.** All entries are pre-rendered inside one `<dialog>`; "Get off here" shows the right one and swaps the URL to the anime page.

Type: Shippori Mincho B1 for titles, Zen Kaku Gothic New for the UI (Google Fonts).

## The 2026 experience: the Seasons Line

The visitor sits in a train; scrolling moves it along the line, one stop per screen, through a realistic matte-painting landscape. Code in `src/years/2026/`:

| File             | Role                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scene.tsx`      | Canvas, camera (follows the scroll, eases like a train, widens its FOV on portrait screens), sky, light and fog, river, station platforms, season titles, telegraph poles, particles.                                                                   |
| `terrain.ts`     | Pure, tested landscape maths: `heightAt` (meadow and river along the track; in front of every stop a valley opening straight ahead, walled by cliffs, closed by a hazy far range), `riverAt`, season blending along the line, and the terrain geometry. |
| `scatter.ts`     | Where every tree and bush goes, by zone (far-bank tree curtain, woods on the slopes, bushes on the banks and the meadow, framing trees by the track between stops only). Deterministic.                                                                 |
| `Vegetation.tsx` | Instances the ez-tree models from `public/models/2026/trees.glb`, with grayscale leaves tinted per season (bare deciduous trees in winter); wind-blown grass.                                                                                           |
| `shaders.ts`     | Sky, terrain (triplanar Poly Haven rock, grass and snow with normal maps, aerial haze), water, grass, poles, particles. All custom shaders end with three's tone mapping and color space chunks.                                                        |
| `palette.ts`     | Per-season colors and particle settings, blended in place every frame.                                                                                                                                                                                  |

Layout rules that the tests guard: the river is the only water (ground never dips below `WATER_Y` elsewhere); a valley opens in front of every stop; no framing tree stands right in front of a resting stop. Stops are `SPACING` = 220 apart so valleys never overlap.

Each station is a small Japanese platform on the neighbouring track (tiled deck with tactile strip, canopy, 駅名標 board, clock, bench, fence, vending machine, wooden station house). Season stops show a tall kanji and the season's name on the far bank, just in front of the tree curtain; the name shrinks to fit the canvas so long French names are never cut.

Contract for any year: `src/years/<year>/Scene.tsx` default-exports a component taking `SceneProps` (`src/years/types.ts`) and calls `onReady` once its first complete frame is on screen.

The hall (`/{lang}/`) stays year-agnostic: a departures board listing every giga season. Each future year gets its own universe.

## Out of scope for now

Visitor comments, analytics, CMS, OST excerpts, importing from my MAL account (planned once the account has history).
