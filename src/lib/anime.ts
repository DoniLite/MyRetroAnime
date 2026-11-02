import { type CollectionEntry, getCollection } from "astro:content";
import { getYear } from "../years";
import { type Lang, pickLocalized } from "./i18n";
import type { Jikan } from "./jikan";
import { SEASONS, type SeasonRef, sameSeason, seasonOf } from "./seasons";

type Meta = CollectionEntry<"meta">["data"];

export interface Anime {
	year: number;
	slug: string;
	meta: Meta & { season: NonNullable<Meta["season"]> };
	/** Jikan cache with the meta.json overrides applied. */
	info: Jikan;
	/** Airing start season, set only when it differs from where the anime sits on the line. */
	airedSeason?: SeasonRef;
	text?: { entry: CollectionEntry<"text">; lang: Lang; fallback: boolean };
}

/** Visible anime of a giga season, in line order. Planned ones are skipped. */
export async function getAnimeOfYear(
	year: number,
	lang: Lang,
): Promise<Anime[]> {
	getYear(year);
	const [metas, jikans, texts] = await Promise.all([
		getCollection("meta"),
		getCollection("jikan"),
		getCollection("text"),
	]);
	assertKnownYears(metas.map((entry) => entry.id));

	const anime: Anime[] = [];
	for (const { id, data: meta } of metas) {
		const [entryYear, slug] = id.split("/") as [string, string];
		if (Number(entryYear) !== year || meta.status === "planned" || !meta.season)
			continue;

		const cached = jikans.find((entry) => entry.id === id)?.data;
		if (!cached)
			throw new Error(`${id}: missing jikan.json, run \`bun run sync\``);
		const info = { ...cached, ...meta.overrides };

		const textByLang: Partial<Record<Lang, CollectionEntry<"text">>> = {};
		for (const entry of texts) {
			if (entry.id.startsWith(`${id}/`))
				textByLang[entry.id.slice(id.length + 1) as Lang] = entry;
		}
		const text = pickLocalized(textByLang, lang);

		const placed = { year, season: meta.season };
		const aired = info.airedFrom ? seasonOf(info.airedFrom) : undefined;
		anime.push({
			year,
			slug,
			meta: { ...meta, season: meta.season },
			info,
			airedSeason: aired && !sameSeason(aired, placed) ? aired : undefined,
			text: text && {
				entry: text.value,
				lang: text.lang,
				fallback: text.lang !== lang,
			},
		});
	}

	// shortcut: within a season, order follows airing end date; add a `finishedOn` field to meta if real watch order matters.
	return anime.sort(
		(a, b) =>
			SEASONS.indexOf(a.meta.season) - SEASONS.indexOf(b.meta.season) ||
			(a.info.airedTo ?? "9").localeCompare(b.info.airedTo ?? "9") ||
			a.info.title.localeCompare(b.info.title),
	);
}

function assertKnownYears(ids: string[]) {
	for (const year of new Set(ids.map((id) => Number(id.split("/")[0]))))
		getYear(year);
}
