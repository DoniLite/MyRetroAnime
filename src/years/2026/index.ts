import type { YearConfig } from "../types";

export default {
	title: { en: "The Seasons Line", fr: "La ligne des saisons" },
	tagline: {
		en: "A train ride through four seasons of anime.",
		fr: "Un voyage en train à travers quatre saisons d'anime.",
	},
	theme: {
		"--accent": "#f2a7b8",
		"--accent-ink": "#2a1420",
	},
	// Drafts by the agent from the season's anime: the owner rewrites them.
	seasons: {
		winter: {
			en: "The season of long-awaited returns: sequels I had been waiting for, one after another, under the snow.",
			fr: "La saison des retours tant attendus : des suites que j'espérais depuis longtemps, l'une après l'autre, sous la neige.",
		},
		spring: {
			en: "New worlds opening like blossoms, and old companions back on the road.",
			fr: "Des mondes nouveaux qui s'ouvrent comme les fleurs, et de vieux compagnons de route qui reviennent.",
		},
		summer: {
			en: "Long evenings, other worlds and fierce battles: the fullest stretch of the line.",
			fr: "De longues soirées, d'autres mondes et des combats acharnés : la portion la plus dense de la ligne.",
		},
		fall: {
			en: "A single stop as the year winds down, and a journey still under way.",
			fr: "Un seul arrêt quand l'année ralentit, et un voyage encore en cours.",
		},
	},
} satisfies YearConfig;
