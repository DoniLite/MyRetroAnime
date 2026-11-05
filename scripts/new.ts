// Scaffold anime folders from MAL ids or URLs.
// Usage: bun run new <id|url>... [--status finished|watching|planned] [--year 2026] [--season fall] [--ep 3]
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { fetchAnime, parseMalId, slugify } from "../src/lib/jikan";
import { SEASONS, type Season, seasonOf } from "../src/lib/seasons";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		status: { type: "string", default: "finished" },
		year: { type: "string", default: String(new Date().getFullYear()) },
		season: { type: "string" },
		ep: { type: "string" },
	},
});

const status = values.status as "finished" | "watching" | "planned";
if (!["finished", "watching", "planned"].includes(status))
	throw new Error(`Unknown status ${status}`);
if (values.season && !SEASONS.includes(values.season as Season))
	throw new Error(`Unknown season ${values.season}`);
if (positionals.length === 0)
	throw new Error("Give at least one MAL id or URL");

let failed = false;
for (const input of positionals) {
	const malId = parseMalId(input);
	if (!malId) {
		console.error(`✗ ${input}: not a MAL id or URL`);
		failed = true;
		continue;
	}
	try {
		const jikan = await fetchAnime(malId);
		const dir = `src/content/${values.year}/${slugify(jikan.title)}`;
		if (existsSync(dir)) {
			console.warn(`• ${dir} already exists, skipped`);
			continue;
		}
		// Finished anime default to the season they finished airing in; watching ones sit in today's season.
		const finishedAiring = jikan.airedTo ?? jikan.airedFrom;
		const season =
			values.season ??
			(status === "finished" && finishedAiring
				? seasonOf(finishedAiring)
				: seasonOf(new Date().toISOString())
			).season;
		const meta = {
			malId,
			status,
			...(status !== "planned" && { season }),
			...(values.ep && { episodesWatched: Number(values.ep) }),
			score: null,
			criteria: [],
		};
		await mkdir(dir, { recursive: true });
		await writeFile(
			`${dir}/meta.json`,
			`${JSON.stringify(meta, null, "\t")}\n`,
		);
		await writeFile(
			`${dir}/jikan.json`,
			`${JSON.stringify(jikan, null, "\t")}\n`,
		);
		await writeFile(
			`${dir}/notes.md`,
			`# ${jikan.title}\n\nRaw notes, never published. Dump ideas here.\n`,
		);
		console.log(
			`✓ ${dir} (${status}${status !== "planned" ? `, ${season}` : ""})`,
		);
	} catch (error) {
		console.error(`✗ ${input}: ${(error as Error).message}`);
		failed = true;
	}
	await Bun.sleep(400); // Stay well under Jikan (3 req/s) and MAL rate limits.
}
process.exitCode = failed ? 1 : 0;
