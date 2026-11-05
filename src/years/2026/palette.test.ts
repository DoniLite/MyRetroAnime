import { describe, expect, it } from "vitest";
import { blendInto, createPalette, PALETTES } from "./palette";

describe("blendInto", () => {
	it("returns each season at the ends and mixes in between", () => {
		const out = createPalette();
		blendInto(out, "winter", "summer", 0);
		expect(out.skyTop.equals(PALETTES.winter.skyTop)).toBe(true);
		blendInto(out, "winter", "summer", 1);
		expect(out.fallSpeed).toBeCloseTo(PALETTES.summer.fallSpeed);
		blendInto(out, "winter", "summer", 0.5);
		expect(out.fallSpeed).toBeCloseTo(
			(PALETTES.winter.fallSpeed + PALETTES.summer.fallSpeed) / 2,
		);
	});
});
