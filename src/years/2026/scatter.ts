import type { Season } from "../../lib/seasons";
import type { Stop } from "../types";
import {
	fbm,
	GROUND_Y,
	heightAt,
	random,
	riverAt,
	SPACING,
	seasonsAt,
	TRACK_EDGE_Z,
	WATER_Y,
} from "./terrain";

/** Model names inside public/models/2026/trees.glb (see scripts/trees.ts), per season. */
const DECIDUOUS_MIX = [
	"oak_1",
	"oak_2",
	"oak_large_1",
	"aspen_1",
	"aspen_2",
	"pine_1",
	"pine_large_1",
];
export const MODELS: Record<
	Season,
	{ trees: string[]; bushes: string[]; rocks: string[]; flowers: string[] }
> = {
	// Winter forests are mostly evergreen; the few bare deciduous trees keep their branches only.
	winter: {
		trees: ["pine_1", "pine_2", "pine_large_1", "pine_1", "oak_1", "aspen_1"],
		bushes: ["bush_1", "bush_2"],
		rocks: [],
		flowers: [],
	},
	spring: {
		trees: DECIDUOUS_MIX,
		bushes: ["bush_1", "bush_2"],
		rocks: [],
		flowers: [],
	},
	summer: {
		trees: DECIDUOUS_MIX,
		bushes: ["bush_1", "bush_2"],
		rocks: [],
		flowers: [],
	},
	fall: {
		trees: DECIDUOUS_MIX,
		bushes: ["bush_1", "bush_2"],
		rocks: [],
		flowers: [],
	},
};

export interface Placement {
	season: Season;
	name: string;
	x: number;
	y: number;
	z: number;
	scale: number;
	rotation: number;
}

/** Height change per unit of ground: trees do not grow on cliffs. */
function steepness(x: number, z: number) {
	return (
		Math.hypot(
			heightAt(x + 1, z) - heightAt(x - 1, z),
			heightAt(x, z + 1) - heightAt(x, z - 1),
		) / 2
	);
}

type Kind = "trees" | "bushes" | "rocks" | "flowers";

/**
 * Vegetation laid out like a landscape painting, in zones rather than at random:
 * a curtain of trees along the far bank, woods in clumps on the slopes, boulders at the water's edge,
 * a sparse meadow, and a few big trees by the track between stations that frame the view as they rush past.
 * Each spot takes the season of its stretch of line.
 */
export function scatterVegetation(
	stops: Stop[],
	length: number,
	density: number,
): Placement[] {
	const rand = random(2026);
	// Every stop (stations and season titles) is a resting view that must stay open.
	const stopXs = stops.map((_, i) => i * SPACING);
	const placements: Placement[] = [];

	const candidates = Math.round(1500 * density * Math.max(1, length / 760));
	for (let n = candidates; n > 0; n--) {
		const x = -100 + rand() * (length + 200);
		const zone = rand();
		const along = rand();
		const roll = rand();
		const pick = rand();
		const size = rand();
		const rotation = rand() * Math.PI * 2;
		const { from, to, t } = seasonsAt(stops, x / SPACING);
		const season = rand() < t ? to : from;
		const river = riverAt(x);
		const nearBank = river.center - river.halfWidth;
		const farBank = river.center + river.halfWidth;
		const nearStop = stopXs.some((sx) => Math.abs(sx - x) < 15);

		let d: number;
		let kind: Kind;
		let scale = 1;
		if (zone < 0.38) {
			d = farBank + 1 + 26 * along ** 1.5;
			kind = roll < 0.8 ? "trees" : "bushes";
		} else if (zone < 0.62) {
			d = 30 + 200 * along ** 1.3;
			if (fbm(x * 0.02, d * 0.02, 3) < 0.5) continue;
			kind = roll < 0.9 ? "trees" : "bushes";
		} else if (zone < 0.74) {
			d = roll < 0.5 ? nearBank - 0.6 * along : farBank + 0.6 * along;
			kind = "bushes";
			scale = 1.2;
		} else if (zone < 0.94) {
			d = 3 + (nearBank - 5) * along;
			kind = roll < 0.45 ? "flowers" : "bushes";
		} else {
			if (nearStop) continue;
			d = 1.5 + 6 * along;
			kind = "trees";
			scale = 1.4;
		}

		const z = TRACK_EDGE_Z - d;
		const y = heightAt(x, z);
		if (y < WATER_Y + 0.15 || y - GROUND_Y > 70 || steepness(x, z) > 0.7)
			continue;

		const pool = MODELS[season][kind];
		if (pool.length === 0) continue;
		// Models are generated at their real height (scripts/trees.ts); this only varies them.
		const base = {
			trees: 0.75 + size * 0.5,
			bushes: 0.8 + size * 0.6,
			rocks: 1,
			flowers: 1,
		}[kind];
		const name = pool[Math.floor(pick * pool.length)] as string;
		placements.push({
			season,
			name,
			x,
			y: y - 0.1,
			z,
			scale: base * scale,
			rotation,
		});
	}
	return placements;
}
