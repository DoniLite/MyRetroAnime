import type { Localized } from "../lib/i18n";

/** Everything that gives a giga season its own identity. Shared UI reads only this. */
export interface YearConfig {
	/** Name of the year's line, shown on the departures board. */
	title: Localized;
	tagline: Localized;
	/** CSS custom properties applied to the year's pages, overriding the shared tokens. */
	theme: Record<`--${string}`, string>;
}
