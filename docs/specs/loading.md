# Spec: scenes that load on slow connections

Status: shipped (2026-11-09). Owner answers and what was built are at the end.

## Problem

On the live site, the 2026 Seasons Line sometimes shows the 2D page instead of the 3D scene, with no error.

Observed on 2026-11-06, loading `https://myretroanime.donilite.me/fr/2026/` in headless Chromium over a slow link (~7 KB/s):

- 12 s and 22 s: `html.has-3d.scene-loading`. Still downloading.
- 32 s: `html` has no class left. The page dropped to 2D.
- No page error, no failed request, no 4xx response.

The cause is the safety timer in `YearLine.astro`. If the scene is not ready 30 s after the first paint, the timer removes `has-3d` and the visitor gets the 2D page. The timer was meant for a scene that crashes or hangs. It cannot tell a hang from a download that is still running.

The download is heavy for 30 s. Here is what the line needs before it reveals itself, as transferred by GitHub Pages (gzip):

| Asset                                            | On the wire |
| ------------------------------------------------ | ----------- |
| `models/2026/trees.glb`                          | ~960 KB     |
| `textures/2026/*.jpg` (6 maps, 1–2K)             | ~840 KB     |
| JS (`Vegetation` chunk with three, React client) | ~320 KB     |
| Fonts, HTML, posters                             | small       |
| **Total**                                        | **~2.2 MB** |

Tallying the table: 960 + 840 + 320 ≈ 2,120 KB, so about 2.2 MB once fonts, HTML and posters are added. Revealing within 30 s needs at least ~75 KB/s. Phones on a weak mobile signal fall below that, and so does a busy network.

The hall (`/{lang}/`) has the same weight, plus the KiHa 32 train (~200 KB gzip). Its 15 s timer only lifts the loading state and keeps 3D, so it reveals a half-loaded scene instead of falling back to 2D.

GitHub Pages is not the bottleneck. It serves static files with gzip and a CDN, under limits we are far from (1 GB site, 100 MB per file, ~100 GB bandwidth a month).

## Goals

1. A visitor whose connection is slow but working always gets the 3D scene. It may take longer, but they are never dropped to 2D while bytes are still arriving.
2. The waiting is visible: the loading state shows how far along the scene is.
3. The scene costs well under half of what it costs today on the wire.
4. A scene that really fails (an asset errors, WebGL is lost, nothing arrives for a long time) still falls back to 2D, so nobody is locked out.

## Non-goals

- Streaming or progressive reveal of a half-loaded scene. The owner's decision stands: no flash, and no scrolling until everything is loaded.
- Code-splitting three.js or rewriting the scenes.
- Moving hosting off GitHub Pages.

## Design

### 1. Fall back on a stall, not on a deadline

- **Progress source.** The scene reports progress from `DefaultLoadingManager.onProgress(url, loaded, total)`. The hall reports progress from its own loading manager. Each report (a file finished) resets a stall timer.
- **Real failure.** The page falls back to 2D only if:
  - no file finishes for **N seconds** (proposal: 20 s), or
  - an asset errors (`onError`, as today), or
  - WebGL creation fails (as today).
- **Hard cap.** It stays as a last resort, but much longer (proposal: 120 s). It catches a scene that keeps trickling bytes forever.
- **Before the scene's JS arrives.** No manager exists until the scene chunk loads, so the inline script in `YearLine.astro` keeps its own timer for that phase only. It runs until the scene chunk has loaded and the scene has mounted, then hands over to the stall timer.
- **The hall.** Same rule, so neither page reveals a half-loaded scene. Its 15 s "lift the lock anyway" becomes the same stall/cap pair. On a real failure it falls back to the 2D hall: the page already works without `has-3d`.

A file-level signal is coarse: `trees.glb` is one file. On a very slow link, that one file can take longer than N seconds while still arriving. Two options:

- **(a)** Load the big assets with `FileLoader` progress events (byte level), and let byte progress also reset the stall timer.
- **(b)** Choose N from the largest asset after compression (see section 2). For example, if no file exceeds 400 KB, 20 s covers connections down to ~20 KB/s.

Recommendation: (b) first, since compression shrinks the problem. Add (a) only if testing shows false fallbacks.

### 2. Progress in the loading state

- The loading screen that already exists (the locked scroll before the reveal) shows a thin progress line and a percentage, computed as `loaded / total` from the manager.
- It is drawn in HTML/CSS on `html.scene-loading`, so it costs nothing once the scene is revealed.
- It matches the site's existing type and colours. Copy goes through `i18n.ts` (FR/EN).

### 3. Lighter assets

- **`trees.glb` (1.76 MB raw, ~960 KB gzip).** Re-export with `gltf-transform` using meshopt compression and quantization, then decode with three's `MeshoptDecoder` (examples/jsm, a few KB). Expected size 200–350 KB. Draco is the alternative: smaller for dense meshes, but it needs a WASM decoder of ~300 KB, which cancels the gain here.
- **KiHa 32 (`scene.bin` ~920 KB raw, plus textures).** Same meshopt pass, with textures resized to what the screen shows (the train is never larger than about a third of the screen).
- **Terrain textures (6 JPGs, ~840 KB).** Convert to WebP at quality ~80 and check whether 1K is enough for each map. Expected size 300–400 KB. KTX2/Basis would save GPU memory too, but it needs a ~200 KB transcoder; not worth it at this size.
- **Target.** Under 1 MB on the wire for the line scene, and under 1.2 MB for the hall.
- **Pipeline.** The compressed files are committed, as the current ones are. A `bun run assets` script (gltf-transform plus sharp, both dev dependencies) regenerates them from sources kept out of `public/`. The build never runs it.

## Acceptance criteria

- With Playwright throttled to 50 KB/s and 300 ms latency (CDP `Network.emulateNetworkConditions`), `/fr/2026/` and `/fr/` both end in 3D (`has-3d` present, `scene-loading` gone), and the progress line advanced before the reveal.
- With the scene chunk or one model blocked (route abort), each page falls back to 2D within N seconds and can be scrolled.
- Wire size, measured from the throttled run's responses: line ≤ 1 MB, hall ≤ 1.2 MB.
- Desktop (1600×900) and phone (390×844) captures of both scenes look the same as before compression: no visible loss on trees, train or terrain.
- Existing tests, Biome, and `bun run build` pass.

## Owner answers (2026-11-09)

1. **Stall delay:** the agent's call, with slow African connections in mind.
2. **Progress display:** the KiHa 32 crossing a thin line from station to station, with the percentage.
3. **No 2D shortcut** for slow or Save-Data visitors: everyone gets the 3D scene, so optimise hard instead.
4. **One PR.**

## What shipped

- **Watchdog** (`components/LoadingTrain.astro`, in `Base`): no fixed timer any more. The page falls back to 2D only after 45 s with no progress at all, or 90 s before the scene's code has arrived. Scenes report progress (`components/loading.ts`) as files finish and as model bytes stream in, so a slow link that keeps delivering always ends in 3D. A file that errors falls back at once, on the hall too.
- **Progress:** the same train indicator on the hall and the line, as `role="progressbar"`.
- **Assets** (`bun run assets`, sources in `assets/`): WebP textures (bark down to 256 px), meshopt-compressed and quantized models (`trees.glb`, `kiha32.glb`).
- **Pages:**
  - MAL posters in their medium size (225 px wide), which is the size they are shown at;
  - the entries' posters lazy;
  - the line's card thumbnails loaded only as their stop comes near;
  - Google Fonts trimmed to the weights in use and no longer render-blocking.

| Measured, local, before gzip | Before | After                                            |
| ---------------------------- | ------ | ------------------------------------------------ |
| Line page, all requests      | 3.9 MB | 2.9 MB, of which MAL images 1.9 MB → 1 thumbnail |
| Scene assets of the line     | 2.9 MB | 1.6 MB (1.3 MB gzip)                             |

**Tests:**
- At 50 KB/s with 300 ms latency, the line reaches 3D in 60 s (85 s before) and the hall in 88 s.
- A blocked model falls back to 2D in seconds; a hanging one after 45 s of silence.
