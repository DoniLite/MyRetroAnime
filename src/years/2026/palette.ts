import { Color } from "three";
import { SEASONS, type Season } from "../../lib/seasons";

const COLOR_KEYS = [
	"skyTop",
	"skyBottom",
	"sun",
	"cloud",
	"ground",
	"hill",
	"rock",
	"mist",
	"near",
	"fore",
	"particle",
	"concrete",
] as const;
const NUMBER_KEYS = [
	"fallSpeed",
	"sway",
	"size",
	"opacity",
	"snowLine",
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];
type NumberKey = (typeof NUMBER_KEYS)[number];
export type Palette = Record<ColorKey, Color> & Record<NumberKey, number>;

function palette(
	colors: Record<ColorKey, string>,
	numbers: Record<NumberKey, number>,
): Palette {
	const result = { ...numbers } as Palette;
	for (const key of COLOR_KEYS) result[key] = new Color(colors[key]);
	return result;
}

// Painted-anime skies: crisp cold winter, soft spring, saturated summer, sunset fall.
// Particles: snow, sakura petals, fireflies (negative speed = they float up), maple leaves.
export const PALETTES: Record<Season, Palette> = {
	winter: palette(
		{
			skyTop: "#4f74ad",
			skyBottom: "#dde6f2",
			sun: "#fff6ea",
			cloud: "#f4f7fb",
			ground: "#eef2f8",
			hill: "#d5ddea",
			rock: "#a6b0c2",
			mist: "#e6ecf5",
			near: "#56658c",
			fore: "#1a1d2b",
			particle: "#ffffff",
			concrete: "#9aa2b4",
		},
		{ fallSpeed: 1.1, sway: 0.6, size: 0.9, opacity: 0.9, snowLine: -15 },
	),
	spring: palette(
		{
			skyTop: "#5b97de",
			skyBottom: "#ffe4ee",
			sun: "#fff7e3",
			cloud: "#ffffff",
			ground: "#a9d48a",
			hill: "#5d9a5c",
			rock: "#b3aea4",
			mist: "#f3e9f0",
			near: "#5f8a5e",
			fore: "#1d2a22",
			particle: "#ffbfd3",
			concrete: "#b9b3ab",
		},
		{ fallSpeed: 0.7, sway: 1.5, size: 1.1, opacity: 0.95, snowLine: 95 },
	),
	summer: palette(
		{
			skyTop: "#1e6fd3",
			skyBottom: "#c4e8ff",
			sun: "#ffffff",
			cloud: "#ffffff",
			ground: "#8cc06a",
			hill: "#3d8945",
			rock: "#aaa597",
			mist: "#d8ecf7",
			near: "#3d7a45",
			fore: "#122016",
			particle: "#fff3a0",
			concrete: "#c8c2b3",
		},
		{ fallSpeed: -0.15, sway: 0.4, size: 0.7, opacity: 0.85, snowLine: 110 },
	),
	fall: palette(
		{
			skyTop: "#2e3f7c",
			skyBottom: "#f3cfa8",
			sun: "#ffe2a8",
			cloud: "#ffd2b0",
			ground: "#d6a456",
			hill: "#b0603a",
			rock: "#a39a90",
			mist: "#f2d6c0",
			near: "#7a4232",
			fore: "#1f1416",
			particle: "#f7a04f",
			concrete: "#93716a",
		},
		{ fallSpeed: 1.0, sway: 1.2, size: 1.2, opacity: 0.9, snowLine: 95 },
	),
};

/** Writes the mix of two seasons into `out` (reused every frame, no allocation). */
export function blendInto(out: Palette, a: Season, b: Season, t: number) {
	const from = PALETTES[a];
	const to = PALETTES[b];
	for (const key of COLOR_KEYS) out[key].lerpColors(from[key], to[key], t);
	for (const key of NUMBER_KEYS)
		out[key] = from[key] + (to[key] - from[key]) * t;
	return out;
}

/** A mutable copy of the first season, to blend into. */
export function createPalette(): Palette {
	const first = PALETTES[SEASONS[0]];
	const out = { ...first };
	for (const key of COLOR_KEYS) out[key] = first[key].clone();
	return out;
}
