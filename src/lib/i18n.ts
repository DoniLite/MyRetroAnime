import type { Season } from "./seasons";

export const LANGS = ["en", "fr"] as const;
export type Lang = (typeof LANGS)[number];
export type Localized = Record<Lang, string>;

export const ui = {
	en: {
		siteTagline: "A yearly look back at the anime that marked me.",
		departures: "Departures",
		atPlatform: "At platform",
		terminus: "Terminus",
		animeCount: "anime",
		backToLine: "Back to the line",
		backToHall: "Back to the hall",
		watching: "Watching",
		episode: "ep.",
		airedIn: "aired",
		episodes: "episodes",
		scorePending: "Score coming",
		notTranslated: "Not yet translated, showing the French version.",
		showSpoilers: "Show all spoilers",
		playTrailer: "Play trailer",
		emptyLine: "No stations yet. The first one is coming soon.",
		chooseLanguage: "Choose your language",
		close: "Close",
		scrollHint: "Scroll to board the train",
		loading: "The train is getting ready…",
		openStation: "Get off here",
		synopsis: "Synopsis (MyAnimeList)",
		station: "Station",
		spoilers: "Spoilers",
		language: "Language",
		line: "Line",
		stations: "Stations",
		status: "Status",
		boarding: "Boarding…",
		pickSeason: "Pick a season, or an anime",
		seeSeason: "Ride to this season",
		animeUnit: "anime",
		animeOne: "anime",
		moreAnime: "more on the line",
	},
	fr: {
		siteTagline: "Une rétro annuelle des animes qui m'ont marqué.",
		departures: "Départs",
		atPlatform: "À quai",
		terminus: "Terminus",
		animeCount: "animes",
		backToLine: "Retour à la ligne",
		backToHall: "Retour au hall",
		watching: "En cours",
		episode: "ép.",
		airedIn: "diffusé",
		episodes: "épisodes",
		scorePending: "Note à venir",
		notTranslated: "Pas encore traduit, version anglaise affichée.",
		showSpoilers: "Afficher tous les spoilers",
		playTrailer: "Lancer le trailer",
		emptyLine: "Aucune gare pour l'instant. La première arrive bientôt.",
		chooseLanguage: "Choisis ta langue",
		close: "Fermer",
		scrollHint: "Scrolle pour monter dans le train",
		loading: "Le train se prépare…",
		openStation: "Descendre ici",
		synopsis: "Synopsis (MyAnimeList)",
		station: "Gare",
		spoilers: "Spoilers",
		language: "Langue",
		line: "Ligne",
		stations: "Gares",
		status: "Statut",
		boarding: "Embarquement…",
		pickSeason: "Choisis une saison, ou un anime",
		seeSeason: "Partir vers cette saison",
		animeUnit: "animes",
		animeOne: "anime",
		moreAnime: "autres sur la ligne",
	},
} satisfies Record<Lang, Record<string, string>>;

export const seasonNames: Record<Lang, Record<Season, string>> = {
	en: { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" },
	fr: { winter: "Hiver", spring: "Printemps", summer: "Été", fall: "Automne" },
};

export function isLang(value: string | undefined): value is Lang {
	return LANGS.includes(value as Lang);
}

export function otherLang(lang: Lang): Lang {
	return lang === "en" ? "fr" : "en";
}

/** Returns the value in `lang`, or in the other language when it is missing. */
export function pickLocalized<T>(
	byLang: Partial<Record<Lang, T>>,
	lang: Lang,
): { value: T; lang: Lang } | undefined {
	for (const candidate of [lang, otherLang(lang)]) {
		const value = byLang[candidate];
		if (value !== undefined) return { value, lang: candidate };
	}
	return undefined;
}
