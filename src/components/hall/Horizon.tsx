import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial } from "three";
import { ridged } from "../../years/2026/terrain";
import { TRAIN } from "./layout";

/**
 * Far ranges behind the valley's end, painted as in a matte painting: each farther plane paler and bluer,
 * snow on the high peaks catching the moon, mist pooling at their feet between the planes.
 */
const RANGES = [
	{
		z: -760,
		base: 40,
		height: 95,
		scale: 0.0065,
		seed: 3,
		color: "#36427a",
		haze: 0.18,
	},
	{
		z: -1050,
		base: 70,
		height: 150,
		scale: 0.0042,
		seed: 11,
		color: "#4a5894",
		haze: 0.42,
	},
	{
		z: -1450,
		base: 110,
		height: 220,
		scale: 0.003,
		seed: 23,
		color: "#6372ad",
		haze: 0.66,
	},
];
const SNOW_FROM = 175;
const SKY = new Color("#8f9ccb");
const MIST = new Color("#7d8bc0");
const SNOW = new Color("#dfe6f7");

function rangeGeometry(range: (typeof RANGES)[number]) {
	const columns = 320;
	const half = 1700;
	const positions = new Float32Array((columns + 1) * 2 * 3);
	const tops = new Float32Array((columns + 1) * 2);
	const xs = Array.from(
		{ length: columns + 1 },
		(_, c) => TRAIN.x - half + (2 * half * c) / columns,
	);
	// Ridged noise gives a ragged crest with a few higher summits; a second octave breaks up the slopes.
	const raw = xs.map((x) => {
		const r = ridged(x * range.scale + range.seed, range.seed * 0.37);
		const detail = ridged(x * range.scale * 4 + range.seed, range.seed);
		return range.base + range.height * (0.8 * r + 0.2 * detail);
	});
	// A light blur over neighbouring columns: no one-column needles.
	const crest = raw.map(
		(_, c) =>
			((raw[c - 1] ?? raw[c]) as number) * 0.25 +
			(raw[c] as number) * 0.5 +
			((raw[c + 1] ?? raw[c]) as number) * 0.25,
	);
	xs.forEach((x, c) => {
		const top = crest[c] as number;
		positions.set([x, -40, range.z, x, top, range.z], c * 6);
		tops.set([top, top], c * 2);
	});
	const index: number[] = [];
	for (let c = 0; c < columns; c++) {
		const a = c * 2;
		index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("aTop", new BufferAttribute(tops, 1));
	geometry.setIndex(index);
	return geometry;
}

export function Horizon() {
	const layers = useMemo(
		() =>
			RANGES.map((range) => ({
				geometry: rangeGeometry(range),
				material: new ShaderMaterial({
					uniforms: {
						uColor: { value: new Color(range.color) },
						uSky: { value: SKY },
						uMist: { value: MIST },
						uSnow: { value: SNOW },
						uHaze: { value: range.haze },
						uSnowFrom: { value: SNOW_FROM },
					},
					vertexShader: /* glsl */ `
						attribute float aTop;
						varying float vY, vTop;
						varying vec2 vXZ;
						void main() {
							vY = position.y;
							vTop = aTop;
							vXZ = position.xz;
							gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
						}
					`,
					fragmentShader: /* glsl */ `
						uniform vec3 uColor, uSky, uMist, uSnow;
						uniform float uHaze, uSnowFrom;
						varying float vY, vTop;
						varying vec2 vXZ;
						void main() {
							vec3 col = uColor;
							// Snow above a level snow line, its edge broken up along the range: no vertical cut.
							float ragged = 9.0 + 5.0 * (sin(vXZ.x * 0.05) + sin(vXZ.x * 0.13 + 1.7));
							float cap = smoothstep(uSnowFrom - 4.0, uSnowFrom + 4.0, vY + ragged);
							col = mix(col, uSnow, cap * 0.55);
							// Paler and bluer with distance, and mist pooling low.
							col = mix(col, uSky, uHaze);
							float mist = 1.0 - smoothstep(-40.0, 0.45 * vTop + 20.0, vY);
							col = mix(col, uMist, mist * 0.85);
							gl_FragColor = vec4(col, 1.0);
							#include <tonemapping_fragment>
							#include <colorspace_fragment>
						}
					`,
				}),
			})),
		[],
	);
	return (
		<>
			{layers.map(({ geometry, material }) => (
				<mesh
					key={geometry.uuid}
					geometry={geometry}
					material={material}
					frustumCulled={false}
				/>
			))}
		</>
	);
}
