# Spec: one continuous journey (hall, line, stations)

Status: draft, to review with the owner before any code ships. Decisions marked **(owner)** were made on 2026-11-06. The rest are proposals.

## Problem

The hall, the year line and the anime stations feel like three separate sites:

- **Hall to line is a page load.** Clicking a grove or a poster on the hall plays the departure for 1.8 s, then loads `/{lang}/{year}/`. The 3D world is destroyed and the line's scene starts from nothing, with its loading lock. The visitor loses the thread.
- **The hall says nothing about the ride.** The line is ridden from inside the train, but on the hall you watch the train from outside, and clicking an anime jumps straight to its station.
- **The groves stand on both sides of the track** with no way across, so walking from one season to the next would mean crossing the rails.
- **The two scenes look different where they should match.** Rails, ballast, ground and platforms are built differently in each, and from a train window you would not see rails the way the line shows them today.
- **The horizon at the end of the hall's valley is flat.** It reads as a uniform blue wall, with no depth.

The line itself is already fluid inside one page: an anime page (`/{lang}/{year}/{slug}/`) is the line scrolled to that station with its entry open in the dialog, and opening entries uses `pushState`. The breaks are at the boundaries: hall to line, line back to hall, and every first load.

## Decisions

1. **One persistent 3D world (owner).** The URLs stay as they are: `/{lang}/`, `/{lang}/{year}/` and `/{lang}/{year}/{slug}/`, each pre-rendered for links, previews and SEO. Navigating between them no longer reloads the page. The WebGL canvas is created once and survives; only the HTML layer changes. Quality stays exactly as it is now: same scenes, same assets, loaded once.
2. **Boarding the train (owner).** Clicking a season or an anime on the hall moves the camera onto the train at the platform and switches to the line's window view. The train departs and rides from the hall's valley into the year's landscape, then stops at that anime's station (or at the start of that season). The line is always lived from inside the train.
3. **Level crossings (owner).** A fumikiri stands between the two groves of each pair: striped barriers and twin red lights that flash and ring when the train passes. A short path joins it to the platform.
4. **Window frame and sway (owner).** On the line, the dark edge of the KiHa 32's window frames the view:
   - posts, sill, and the corner of a seat;
   - a light sway and vibration;
   - near ground blurred by speed instead of crisp rails;
   - visible braking at each station.

   Platforms, lamps and ballast are the same as the hall's.

## Design

### 1. Navigation without reloads

- **Router.** Astro's `<ClientRouter />` (View Transitions) goes in `Base.astro`. Internal links are fetched and swapped in without a reload.
- **The 3D island.** It moves from the pages into `Base.astro` as a single `<World client:only="react" transition:persist />`. It owns the one R3F `<Canvas>` and decides what to render from the current route: hall, line, or line plus open entry. It learns about route changes through `astro:page-load` and the URL.
- **The HTML layer.** Hero text, board, captions, stop sections and the entry dialog stay in each page, so every URL still renders on its own (first load, no JS, 2D fallback).
- **Page scripts.** The inline scripts in `YearLine.astro` and `[lang]/index.astro` run once per document today. They move to `astro:page-load` handlers that clean up on `astro:before-swap`. The has-3d decision becomes a check the world makes once, not something each page re-runs.
- **The hall's `[data-depart]` links.** They stop navigating after a timeout. They start the boarding sequence (section 2), and the router swaps the URL to the line when the train leaves the hall's valley.
- **Back and forward.** These replay the ride in reverse, quicker than the way out (line back to hall: the train returns through the tunnel to the platform). Any click, scroll or navigation during a ride skips straight to its destination, so nobody waits on the animation. The browser's Back must never feel broken: an entry's Back closes the entry, as it does today.
- **First load on a deep link** (`/fr/2026/some-anime/`). The world starts directly in the train at that station with the entry open, with no ride, as today.

### 2. The ride from the hall into the year

- **Boarding.** The camera glides from its current stop down to the train's door, then turns to face the right-hand window. The window frame fades in around the view. That takes about 1.5 s. The train is at the platform for stage 0. At a grove stop, the train is already standing at the camera's level, so the camera steps in.
- **Departure.** The train pulls out and the hall's valley slides past the window: platform lamps, groves, shrines, level crossings ringing as the train passes.
- **The seam: a tunnel (proposal).** At the end of the valley the line enters a short tunnel under the far range. In the dark, the hall scene is unloaded and the year scene takes over. The train comes out into the year's landscape and its season, and rides on to the target stop. The tunnel hides the change of world, scale and lighting with no visible cut. It also gives the year scene's assets a moment to finish if they are still arriving: the train waits in the tunnel, lit only by its own windows, until they do.
- **Preloading.** The year's assets start loading while the visitor is still on the hall, after the hall has revealed itself and at low priority. Most visitors board after a few seconds, so the tunnel rarely has to wait.

### 3. Feeling the train on the line

- **Window frame.** A dark silhouette drawn in front of the camera:
  - window posts and a rounded corner;
  - the sill with a thin highlight;
  - the edge of a seat back in one bottom corner.

  It must stay narrow: it may cover at most ~8% of the view at each side and ~10% at the bottom, so the landscape and season titles keep their size. On phones it shrinks to a thin border. It is built as a few meshes on a camera-attached group, not as an image overlay, so it sways with the car.
- **Motion.**
  - A low-frequency roll (±0.3°) and a vertical vibration that grows with speed.
  - Small jolts at rail joints, timed to distance travelled.
  - Braking into stations eases the camera forward slightly, then settles it.
- **Near ground.** The ballast and sleepers right under the window are replaced by a strip with motion blur along the direction of travel, sharp only while stopped at a station.
- **Shared track furniture.**
  - Ballast, sleepers, rails, platform concrete, tactile strip and lamps come from one module (`components/world/track.tsx`), used by the hall and every year.
  - The line's station platforms become the hall's platform model, dressed per season (snow on the edge in winter).
  - This moves the `shortcut:` in `hall/layout.ts` (the hall borrowing the 2026 terrain shader and trees) into a proper shared module.

### 4. Level crossings in the hall

- **Placement.** One fumikiri per pair of groves, a few metres before the pair's sandō entrances. The platform's outer path steps down to it.
- **Parts.**
  - A boom barrier on each side, striped yellow and black.
  - A post with the X-shaped crossbuck.
  - Twin red lamps and a small bell housing.
  - Timber boards between the rails.
- **Behaviour.**
  - When the train approaches (during boarding rides, and when the camera's dive runs the train past), the lamps alternate and the barriers lower.
  - They lift once the train has gone.
  - The bell is part of the sound backlog (off by default) and is not in this scope.

### 5. Depth at the horizon (hall)

The far end of the hall's valley gets layered ranges, as on the 2026 line:

- three planes of ridges, each paler and bluer with distance;
- snow on the higher peaks catching the moonlight;
- valley mist pooling between the planes;
- a ragged, varied skyline instead of today's flat line.

The tunnel mouth (section 2) sits at the foot of the nearest of these ranges.

## Performance and memory

- Only one scene's heavy content is mounted at a time: the hall unmounts in the tunnel. The tree models, textures and train model are shared and loaded once.
- The canvas, renderer and caches live for the whole visit. GPU memory must be released when a scene unmounts: dispose geometries, materials and canvas textures that the scene created.
- This builds on [loading.md](loading.md). The stall-based fallback and compressed assets apply to the world, not per page.

## Acceptance criteria

- **No reload.** Hall → click a poster → arrive at that anime's station with its entry open, without a document reload. Check that `performance.getEntriesByType("navigation")` is unchanged and that the canvas element is the same node.
- **URLs.** The URL is `/{lang}/{year}/{slug}/` on arrival. Back closes the entry. Back again returns to the hall.
- **Deep links.** A direct load of any URL renders as today: the 2D layer works without JS, and 3D starts at the right place.
- **The ride.** It passes the level crossing (lamps flashing, barriers down) and goes through the tunnel. The year's landscape appears with no visible cut.
- **Window frame.** It is visible on desktop and on phone, and the season titles stay readable at every stop.
- **Captures.** Desktop 1600×900 and phone 390×844 at the hall stops, mid-ride, in the tunnel, and at the first station of each season.
- **No regression.** The line's look (terrain, trees, particles, river, titles) is unchanged apart from the frame, the sway and the near-ground blur.
- **Checks.** Tests, Biome and `bun run build` pass.

## Delivery

This is too big for one change. Proposed order, each step shippable on its own:

1. Shared track furniture, level crossings, horizon depth in the hall. These are visual only, with no architecture change. _Level crossings and horizon done (2026-11-06). The shared track module moves to step 2, where the line becomes its second user._
2. Window frame, sway, near-ground blur and braking on the 2026 line. _Done (2026-11-09): the page's existing `.window` frame gained a sill and a seat back; Line adds roll, speed hum, rail-joint knocks and a forward lean when braking; `Cabin.tsx` smears the near ballast while running. Still open: making the line's stations the hall's platform model (shared track module), left for when the persistent world (step 4) puts both in one scene._
3. The loading fixes from [loading.md](loading.md).
4. The persistent world: `ClientRouter`, `World` island, scripts moved to router events, deep links.
5. Boarding, the ride and the tunnel; preloading the year from the hall.

## Owner answers (2026-11-06)

1. **Tunnel:** yes, it is the seam between the hall and the year.
2. **Back:** replay the ride in reverse, but fast. It must never hold up a visitor who wants to leave or go somewhere else:
   - the reverse ride is quicker than the outbound one;
   - any new navigation, scroll or click during a ride skips straight to its destination.
3. **Delivery order:** yes, and move faster.
