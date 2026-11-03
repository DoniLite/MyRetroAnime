import { describe, expect, it } from "vitest";
import type { Stop } from "../types";
import {
	GROUND_Y,
	heightAt,
	random,
	riverAt,
	SPACING,
	seasonsAt,
	TRACK_EDGE_Z,
	WATER_Y,
} from "./terrain";

const stops: Stop[] = [
	{ kind: "intro", season: "winter" },
	{ kind: "season", season: "winter", label: "Winter" },
	{ kind: "season", season: "spring", label: "Spring" },
];

describe("heightAt", () => {
	it("keeps the plain near the track low", () => {
		for (const x of [0, 137, 512]) {
			expect(Math.abs(heightAt(x, -8) - GROUND_Y)).toBeLessThan(1);
		}
	});

	it("opens a valley in front of each stop, walled by the massif between stops", () => {
		for (const stop of [0, SPACING, 4 * SPACING]) {
			const valley = heightAt(stop, -150);
			const wall = heightAt(stop + SPACING / 2, -150);
			expect(wall).toBeGreaterThan(valley + 40);
		}
	});
});

describe("water", () => {
	it("only lies in the river: dry land everywhere else, so no stray ponds", () => {
		const rand = random(3);
		for (let n = 0; n < 2000; n++) {
			const x = rand() * 2000;
			const d = rand() * 300;
			const { center, halfWidth } = riverAt(x);
			if (Math.abs(d - center) < halfWidth) continue;
			expect(heightAt(x, TRACK_EDGE_Z - d)).toBeGreaterThan(WATER_Y);
		}
	});
});

describe("seasonsAt", () => {
	it("blends between neighbouring stops and clamps at the ends", () => {
		expect(seasonsAt(stops, 1.5)).toMatchObject({
			from: "winter",
			to: "spring",
			t: 0.5,
		});
		expect(seasonsAt(stops, -3)).toMatchObject({ from: "winter", t: 0 });
		expect(seasonsAt(stops, 99)).toMatchObject({
			from: "spring",
			to: "spring",
		});
	});
});

describe("random", () => {
	it("is deterministic and stays in [0, 1)", () => {
		const a = random(7);
		const b = random(7);
		for (let i = 0; i < 100; i++) {
			const value = a();
			expect(value).toBe(b());
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});
