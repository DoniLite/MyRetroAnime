import { describe, expect, it } from "vitest";
import { groupBySeason, sameSeason, seasonOf } from "./seasons";

describe("seasonOf", () => {
	it("maps calendar quarters to MAL seasons", () => {
		expect(seasonOf("2026-01-01T00:00:00+00:00")).toEqual({
			year: 2026,
			season: "winter",
		});
		expect(seasonOf("2026-03-31T23:00:00+00:00")).toEqual({
			year: 2026,
			season: "winter",
		});
		expect(seasonOf("2026-04-01T00:00:00+00:00")).toEqual({
			year: 2026,
			season: "spring",
		});
		expect(seasonOf("2026-09-30T00:00:00+00:00")).toEqual({
			year: 2026,
			season: "summer",
		});
		expect(seasonOf("2025-12-31T00:00:00+00:00")).toEqual({
			year: 2025,
			season: "fall",
		});
	});
});

describe("sameSeason", () => {
	it("compares year and season", () => {
		expect(
			sameSeason(
				{ year: 2026, season: "fall" },
				{ year: 2026, season: "fall" },
			),
		).toBe(true);
		expect(
			sameSeason(
				{ year: 2025, season: "fall" },
				{ year: 2026, season: "fall" },
			),
		).toBe(false);
	});
});

describe("groupBySeason", () => {
	it("keeps calendar order and drops empty seasons", () => {
		const groups = groupBySeason([
			{ id: "a", season: "fall" as const },
			{ id: "b", season: "winter" as const },
			{ id: "c", season: "fall" as const },
		]);
		expect(groups.map((g) => [g.season, g.items.map((i) => i.id)])).toEqual([
			["winter", ["b"]],
			["fall", ["a", "c"]],
		]);
	});
});
