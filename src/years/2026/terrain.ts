import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";
import type { Season } from "../../lib/seasons";
import type { Stop } from "../types";
import { PALETTES } from "./palette";

/** World units between two stops: one scroll-snapped screen moves the train this far. */
export const SPACING = 220;
/** The line runs along +x at z = 0; the landscape stretches toward -z. */
export const TRACK_EDGE_Z = -7;
export const GROUND_Y = -1.7;
export const WATER_Y = -1.95;
/** Squared-exponential haze, shared by every material so near and far fade alike. */
export const FOG_DENSITY = 0.0026;
/** Low and from the right, where the sun is painted in the sky. */
export const SUN_DIRECTION = new Vector3(110, 55, 15).normalize();

function hash(x: number, y: number) {
	const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
	return h - Math.floor(h);
}

function noise(x: number, y: number) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const ux = fx * fx * (3 - 2 * fx);
	const uy = fy * fy * (3 - 2 * fy);
	const a = hash(ix, iy);
	const b = hash(ix + 1, iy);
	const c = hash(ix, iy + 1);
	const d = hash(ix + 1, iy + 1);
	return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm(x: number, y: number, octaves = 5) {
	let value = 0;
	let amplitude = 0.5;
	for (let i = 0; i < octaves; i++) {
		value += amplitude * noise(x, y);
		x *= 2.03;
		y *= 2.03;
		amplitude *= 0.5;
	}
	return value;
}

export const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** Ridged multifractal: sharp crests and deep valleys, the signature of real mountain ranges. */
function ridged(x: number, y: number) {
	let value = 0;
	let amplitude = 0.55;
	let weight = 1;
	for (let i = 0; i < 6; i++) {
		let n = 1 - Math.abs(noise(x, y) * 2 - 1);
		n = n * n * weight;
		weight = Math.min(1, n * 1.8);
		value += n * amplitude;
		x *= 2.07;
		y *= 2.07;
		amplitude *= 0.5;
	}
	return value;
}

/** A river running alongside the line, meandering between the platform side and the far bank. */
export function riverAt(x: number) {
	return {
		center: 20 + 4 * Math.sin(x * 0.018) + 2 * Math.sin(x * 0.051 + 1),
		halfWidth: 6 + 1.5 * Math.sin(x * 0.031 + 2),
	};
}

/**
 * Ground height, composed like a matte painting: a meadow and a river along the track, then in front of
 * every stop a valley opening straight ahead, walled by dark cliffs that frame the view and closed far
 * away by a hazy range. Between stops the massif comes close, so the train runs along mountain walls.
 */
export function heightAt(x: number, z: number) {
	const d = Math.max(0, TRACK_EDGE_Z - z);
	// Gentle swells that never dip below the water: the river is the only water in the landscape.
	const plain = Math.max(0, fbm(x * 0.045, z * 0.06, 3) - 0.45) * 1.6;
	const river = riverAt(x);
	const across = Math.abs(d - river.center) / river.halfWidth;
	const bed = across < 1 ? 1.5 * (1 - across * across) : 0;

	const stop = Math.round(x / SPACING) * SPACING;
	const valleyHalfWidth = Math.min(105, 55 + d * 0.12);
	const inValley = Math.abs(x - stop) / valleyHalfWidth;
	const walls = smoothstep(0.6, 1.15, inValley);

	const massif =
		smoothstep(40, 110, d) * (50 + 150 * ridged(x * 0.006 + 9, z * 0.007));
	const floor =
		smoothstep(40, 500, d) * 26 +
		smoothstep(50, 160, d) * 8 * fbm(x * 0.02 + 3, z * 0.02) +
		// Spurs reaching into the valley, receding in layers toward the far range.
		smoothstep(120, 320, d) * 45 * ridged(x * 0.01 + 2, z * 0.006);
	const farRange =
		smoothstep(370, 500, d) * (60 + 110 * ridged(x * 0.004 + 4, z * 0.004));

	const relief =
		floor + farRange + (massif + farRange * 0.3 - floor - farRange) * walls;
	return GROUND_Y + plain - bed + relief;
}

/** The two seasons around a point of the line (in stops) and how far it has moved from one to the next. */
export function seasonsAt(
	stops: Stop[],
	index: number,
): { from: Season; to: Season; t: number } {
	const clamped = Math.min(Math.max(index, 0), stops.length - 1);
	const i = Math.floor(clamped);
	const from = stops[i]?.season ?? "winter";
	const to = stops[Math.min(i + 1, stops.length - 1)]?.season ?? from;
	const t = clamped - i;
	return { from, to, t: t * t * (3 - 2 * t) };
}

const scratch = { a: new Color() };

/** Season-blended palette color at a world x, for colors baked into geometry. */
export function colorAt(
	stops: Stop[],
	x: number,
	key: "ground" | "hill" | "rock" | "particle" | "mist",
	out: Color,
) {
	const { from, to, t } = seasonsAt(stops, x / SPACING);
	return out.lerpColors(PALETTES[from][key], PALETTES[to][key], t);
}

function snowLineAt(stops: Stop[], x: number) {
	const { from, to, t } = seasonsAt(stops, x / SPACING);
	return (
		PALETTES[from].snowLine +
		(PALETTES[to].snowLine - PALETTES[from].snowLine) * t
	);
}

/** One long terrain strip along the line, denser near the track; season tints baked per vertex for the shader. */
export function buildTerrain(stops: Stop[], length: number) {
	const x0 = -260;
	const x1 = length + 260;
	const columns = Math.ceil((x1 - x0) / 3);
	const rows = 130;
	const count = (columns + 1) * (rows + 1);
	const positions = new Float32Array(count * 3);
	const grass = new Float32Array(count * 3);
	const rock = new Float32Array(count * 3);
	const snow = new Float32Array(count);
	const { a } = scratch;

	for (let row = 0; row <= rows; row++) {
		// Rows bunch up near the track where the eye can see detail, and spread out far away.
		const z = 6 - 530 * (row / rows) ** 1.7;
		for (let column = 0; column <= columns; column++) {
			const x = x0 + ((x1 - x0) * column) / columns;
			const v = row * (columns + 1) + column;
			positions.set(
				[x, z > TRACK_EDGE_Z ? GROUND_Y : heightAt(x, z), z],
				v * 3,
			);
			colorAt(stops, x, "ground", a);
			grass.set([a.r, a.g, a.b], v * 3);
			colorAt(stops, x, "rock", a);
			rock.set([a.r, a.g, a.b], v * 3);
			snow[v] = GROUND_Y + snowLineAt(stops, x);
		}
	}

	const index = new Uint32Array(columns * rows * 6);
	let k = 0;
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const p = row * (columns + 1) + column;
			const q = p + columns + 1;
			// Counter-clockwise seen from above, so the ground faces the sky.
			index.set([p, p + 1, q, p + 1, q + 1, q], k);
			k += 6;
		}
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("aGrass", new BufferAttribute(grass, 3));
	geometry.setAttribute("aRock", new BufferAttribute(rock, 3));
	geometry.setAttribute("aSnowLine", new BufferAttribute(snow, 1));
	geometry.setIndex(new BufferAttribute(index, 1));
	geometry.computeVertexNormals();
	return geometry;
}

/** Deterministic random numbers, so the forest is the same on every visit. */
export function random(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 4294967296;
	};
}
