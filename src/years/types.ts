import type { Localized } from "../lib/i18n";
import type { Season } from "../lib/seasons";

/** Everything that gives a giga season its own identity. Shared UI reads only this. */
export interface YearConfig {
	/** Name of the year's line, shown on the departures board. */
	title: Localized;
	tagline: Localized;
	/** CSS custom properties applied to the year's pages, overriding the shared tokens. */
	theme: Record<`--${string}`, string>;
	/** A line or two about each season of the year, shown in the hall beside its avenue. */
	seasons?: Partial<Record<Season, Localized>>;
}

/** One screen of a year's line. Every stop is one scroll-snapped viewport. */
export type Stop =
	| { kind: "intro"; season: Season }
	/** `label` is the season name in the page language, written into the landscape by the scene. */
	| { kind: "season"; season: Season; label: string }
	| {
			kind: "station";
			season: Season;
			slug: string;
			title: string;
			titleJapanese: string | null;
			image: string | null;
	  };

/** Contract of src/years/<year>/Scene.tsx, the year's 3D layer. */
export interface SceneProps {
	stops: Stop[];
	/** Called once the first frame is on screen, so the page can fade the scene in. */
	onReady?: () => void;
	/** Called when a required asset fails to load: the page falls back to the 2D line. */
	onFail?: () => void;
}
