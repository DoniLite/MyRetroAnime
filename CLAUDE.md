# MyRetroAnime

A yearly, immersive retrospective of the anime the owner watched (one **giga season** per year), static on GitHub Pages. Read before working:

- [docs/ROADMAP.md](docs/ROADMAP.md): goal, status, what comes next, and the design decisions the owner already made. Read it before proposing or changing anything visual.
- [docs/DESIGN.md](docs/DESIGN.md): how the site works (content model, routes, year line, the 2026 scene). Read it before touching code.

## Working with the owner

- Chat in French; code, comments, commits and docs in English.
- For design questions, ask one decision at a time with a recommended option.
- Visual work is done when you have looked at it: build, serve, and capture desktop (1600×900) and phone (390×844) screenshots of the stops you changed, every season you touched. Report what you did not capture.
- Change only what was asked. When the owner tweaks a visual, adjust that one thing; keep the rest as it is.

## Gotchas

- `bun run build` runs `astro check`, which needs TypeScript 6 (not 7).
- Biome cannot see `.astro` templates: unused-import rules are off for them; `jikan.json` caches are excluded from formatting.
- R3F copies JSX `uniforms`: shader materials are built by hand (`useShader` in `Scene.tsx`) so per-frame uniform updates reach the GPU.
- Custom shaders end with `#include <tonemapping_fragment>` and `#include <colorspace_fragment>`, or they render darker than three's own materials.
- Load models with `GLTFLoader.load` (not `loadAsync`) when the callback queues more textures, so `DefaultLoadingManager` keeps the scene in its loading state.
- Metadata: `bun run new` / `bun run sync` use the official MAL API when `MAL_CLIENT_ID` is in `.env` (git-ignored), Jikan otherwise. The build never calls either.
- Network can be flaky here: Jikan and MAL CDN lookups sometimes fail; retry before concluding.
- Screenshots: Playwright's Chromium works headless with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`; wait for `scene-loading` to leave `<html>` before capturing. `astro preview` may land on port 4322 if the owner's dev server holds 4321.
