export const SEASONS = ["winter", "spring", "summer", "fall"] as const;
export type Season = (typeof SEASONS)[number];

export interface SeasonRef {
	year: number;
	season: Season;
}

// MAL anime seasons are calendar quarters: Jan–Mar winter … Oct–Dec fall.
export function seasonOf(isoDate: string): SeasonRef {
	const date = new Date(isoDate);
	return {
		year: date.getUTCFullYear(),
		season: SEASONS[Math.floor(date.getUTCMonth() / 3)] as Season,
	};
}

export function sameSeason(a: SeasonRef, b: SeasonRef): boolean {
	return a.year === b.year && a.season === b.season;
}

/** Groups items in calendar order, dropping empty seasons. */
export function groupBySeason<T extends { season: Season }>(
	items: T[],
): { season: Season; items: T[] }[] {
	return SEASONS.map((season) => ({
		season,
		items: items.filter((item) => item.season === season),
	})).filter((group) => group.items.length > 0);
}
