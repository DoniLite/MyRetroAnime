import { describe, expect, it } from "vitest";
import type { Stop } from "../types";
import { MODELS, scatterVegetation } from "./scatter";
import { heightAt, SPACING, TRACK_EDGE_Z, WATER_Y } from "./terrain";

const stops: Stop[] = [
	{ kind: "intro", season: "winter" },
	{ kind: "season", season: "winter", label: "Winter" },
	{
		kind: "station",
		season: "winter",
		slug: "a",
		title: "A",
		titleJapanese: null,
		image: null,
	},
	{ kind: "season", season: "fall", label: "Fall" },
];
const length = (stops.length - 1) * SPACING;

describe("scatterVegetation", () => {
	const placements = scatterVegetation(stops, length, 1);

	it("is deterministic and plants something", () => {
		expect(placements.length).toBeGreaterThan(100);
		expect(scatterVegetation(stops, length, 1)).toEqual(placements);
	});

	it("keeps the track and the water clear, and no big tree right in front of a station", () => {
		const trees = new Set(Object.values(MODELS).flatMap((set) => set.trees));
		for (const p of placements) {
			expect(p.z).toBeLessThan(TRACK_EDGE_Z);
			expect(heightAt(p.x, p.z)).toBeGreaterThan(WATER_Y);
			const framingStation =
				trees.has(p.name) &&
				Math.abs(p.x - 2 * SPACING) < 16 &&
				TRACK_EDGE_Z - p.z < 8;
			expect(framingStation).toBe(false);
		}
	});

	it("only uses models of the placement's season", () => {
		for (const p of placements) {
			const set = MODELS[p.season];
			expect([
				...set.trees,
				...set.bushes,
				...set.rocks,
				...set.flowers,
			]).toContain(p.name);
		}
	});
});
