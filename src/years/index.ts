import type { YearConfig } from "./types";

const modules = import.meta.glob<{ default: YearConfig }>("./*/index.ts", {
	eager: true,
});

/** Registered giga seasons, newest first. */
export const years = Object.entries(modules)
	.map(([path, module]) => ({
		year: Number(path.split("/")[1]),
		config: module.default,
	}))
	.sort((a, b) => b.year - a.year);

export function getYear(year: number) {
	const found = years.find((entry) => entry.year === year);
	if (!found)
		throw new Error(`No src/years/${year}/index.ts for giga season ${year}`);
	return found;
}
