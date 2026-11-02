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
  years/<year>/index.ts    the year's identity: line name, tagline, theme tokens (later: its 3D scene)
  years/index.ts           registry of giga seasons, read through import.meta.glob
  lib/                     shared logic: seasons, i18n, Jikan, anime loading
  components/              shared UI (header, entry, trailer facade, spoilers)
  pages/                   routes
scripts/                   new.ts (scaffold anime), sync-jikan.ts (refresh cache)
```

Adding a year = adding `src/years/<year>/index.ts`. Content in a year folder without a matching year module fails the build.

## Routes

| URL                      | Page                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `/`                      | Picks the saved language, then the browser language, then English, and redirects (client-side, Pages has no server redirects). |
| `/{lang}/`               | The hall: a departures board listing every giga season. The current year is "at platform".                                     |
| `/{lang}/{year}/`        | The year's line: stations grouped by season.                                                                                   |
| `/{lang}/{year}/{slug}/` | One anime. Pre-rendered so links get real previews and SEO. Once the 3D lands, it opens the train at that station.             |

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

The build never calls Jikan, so a Jikan outage never blocks a deploy.

## MDX components

Available now: `<Spoiler>` (hidden until clicked; a global "show all spoilers" switch is remembered per browser).

Planned: `<Moment>` (key scene: image, episode, timestamp), `<Gallery>`, `<Clip>` (short MP4/WebM, ~3 MB max; longer goes to YouTube), `<Explain>` ("the detail you may have missed").

## The 2026 experience: the Seasons Line (planned)

- A train crosses four landscapes, one per season. Each anime is a station. The last stop is a **terminus** recapping the year (top picks, stats computed from `meta.json`, closing words), shown as "next stop: to be continued" until the year ends.
- **Art direction:** painted, Makoto Shinkai style, generated mostly with shaders (sky, clouds, light, parallax silhouettes), a few assets.
- **Camera:** window view from inside the carriage between stations, outside shots during season transitions.
- **Navigation:** scroll or swipe moves the train and snaps to stations; arrow keys and a line mini-map jump directly.
- **Content:** shown as an overlay inside the scene. The anime URL updates as the train moves.
- **Fallback:** the 2D pages above are the baseline. 3D only mounts with WebGL, drops quality when the frame rate falls, goes static with `prefers-reduced-motion`, and a reading mode is always available.
- **Sound:** ambient (train, rain, cicadas), off by default.

The hall (`/{lang}/`) stays year-agnostic: a station hall with a split-flap departures board. Future years get their own platform and their own universe.

## Out of scope for now

Visitor comments, analytics, CMS, OST excerpts, importing from my MAL account (planned once the account has history).
