# MyRetroAnime

A yearly look back at the anime that marked me, one **giga season** per year. Live at [myretroanime.donilite.me](https://myretroanime.donilite.me).

Built with Astro, deployed to GitHub Pages. See [docs/DESIGN.md](docs/DESIGN.md) for how it works.

## Commands

| Command                    | What it does                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `bun install`              | Install dependencies                                                                |
| `bun run dev`              | Local dev server                                                                    |
| `bun run new <mal-url>...` | Scaffold anime folders (`--status watching --ep 3`, `--season fall`, `--year 2026`) |
| `bun run sync`             | Refresh the cached MAL metadata of every anime                                      |
| `bun run test`             | Unit tests                                                                          |
| `bun run lint`             | Biome lint and format check                                                         |
| `bun run build`            | Type-check and build to `dist/`                                                     |
