// biome-ignore-all lint/a11y/noStaticElementInteractions: three.js objects, not DOM; the page's HTML links give keyboard access.
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	Color,
	DoubleSide,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	ShaderMaterial,
	SRGBColorSpace,
	Vector3,
} from "three";
import type { Season } from "../../lib/seasons";
import { barkMaterial, leafMaterial } from "../../years/2026/Vegetation";
import { gltfLoader } from "../loading";
import {
	CLEARING_START,
	cameraStage,
	grovePlacement,
	hallHeight,
	propSlots,
	sando,
	sandoLength,
	TRAIN,
} from "./layout";
import { type HallItem, PropField } from "./Props";
import { glowTexture, go, hover, random } from "./shared";

export interface HallSeason {
	season: Season;
	label: string;
	items: HallItem[];
}

/** Each season's trees: species from trees.glb, and their foliage tint (none = bare branches). */
const GROVE_TREES: Record<
	Season,
	{ names: string[]; leaf: string; tint?: string; bark: string }
> = {
	winter: {
		names: ["pine_1", "pine_2", "pine_large_1"],
		leaf: "pine",
		tint: "#8ea598",
		bark: "pine",
	},
	spring: {
		names: ["oak_1", "oak_2", "oak_large_1"],
		leaf: "oak",
		tint: "#ffd3e0",
		bark: "oak",
	},
	summer: {
		names: ["oak_1", "aspen_1", "oak_large_1"],
		leaf: "oak",
		tint: "#84b65a",
		bark: "oak",
	},
	fall: {
		names: ["oak_1", "oak_2", "aspen_2"],
		leaf: "oak",
		tint: "#e8823f",
		bark: "oak",
	},
};

/** The valley's own dark pines, as in the corridor from the station: the seasons fade into them. */
const EVERGREEN = {
	names: ["pine_1", "pine_2", "pine_large_1"],
	leaf: "pine",
	tint: "#4f6f4a",
	bark: "pine",
};
type Kind = Season | "evergreen";
const kindOf = (kind: Kind) =>
	kind === "evergreen" ? EVERGREEN : GROVE_TREES[kind];

/** Particles drifting in each grove, as on the year line: snow, petals, fireflies, leaves. */
const GROVE_PARTICLES: Record<
	Season,
	{ color: string; fall: number; sway: number; size: number }
> = {
	winter: { color: "#ffffff", fall: 1.1, sway: 0.5, size: 0.9 },
	spring: { color: "#ffc2d4", fall: 0.6, sway: 1.4, size: 1.1 },
	summer: { color: "#fff3a0", fall: -0.15, sway: 0.4, size: 0.8 },
	fall: { color: "#f7a04f", fall: 0.9, sway: 1.1, size: 1.2 },
};

export function Groves({
	seasons,
	lineUrl,
	stage,
}: {
	seasons: HallSeason[];
	lineUrl: string;
	stage: () => number;
}) {
	return (
		<>
			<GroveTrees seasons={seasons} />
			{seasons.slice(0, 4).map((grove, i) => (
				<Grove
					key={grove.season}
					index={i}
					grove={grove}
					lineUrl={lineUrl}
					stage={stage}
				/>
			))}
		</>
	);
}

function Grove({
	index,
	grove,
	lineUrl,
	stage,
}: {
	index: number;
	grove: HallSeason;
	lineUrl: string;
	stage: () => number;
}) {
	const { x, z, y, stage: stop } = grovePlacement(index);
	const [cx, , cz] = cameraStage(stop).position;
	// Along the curving sandō, from the torii to the shrine, and across it, on the ground.
	const { at, length, heading } = useMemo(() => {
		const path = sando(index, sandoLength(grove.items.length));
		const at = (t: number, offset = 0) => {
			const [px, pz] = path.at(t, offset);
			return [px, hallHeight(px, pz), pz] as [number, number, number];
		};
		return { at, length: path.length, heading: path.heading };
	}, [index, grove.items.length]);
	const toCamera = (p: readonly number[]) =>
		Math.atan2(cx - (p[0] as number), cz - (p[2] as number));
	const goToSeason = (event: ThreeEvent<MouseEvent>) => {
		event.stopPropagation();
		go(`${lineUrl}#${grove.season}`);
	};
	const pointer = {
		onClick: goToSeason,
		onPointerOver: (event: ThreeEvent<PointerEvent>) => {
			event.stopPropagation();
			document.body.style.cursor = "pointer";
			hover({ label: grove.label });
		},
		onPointerOut: () => {
			document.body.style.cursor = "";
			hover(null);
		},
	};
	const gate = at(0);
	const title: [number, number, number] = [gate[0], gate[1] + 14, gate[2]];
	return (
		<>
			<Sando at={at} length={length} heading={heading} />
			<group position={gate} rotation-y={heading(0)} {...pointer}>
				<Torii snow={grove.season === "winter"} />
			</group>
			<group position={at(1.06)} rotation-y={heading(1) + Math.PI}>
				<Hokora snow={grove.season === "winter"} />
			</group>
			{/* Small stone lanterns at both ends of the approach, so even a one-anime season feels tended. */}
			{[2 / length, 1 - 3 / length].flatMap((t) =>
				[-2.2, 2.2].map((offset) => (
					<group key={`${t}${offset}`} position={at(t, offset)}>
						<StoneLantern />
					</group>
				)),
			)}
			<PropField
				index={index}
				season={grove.season}
				items={grove.items}
				lineUrl={lineUrl}
				stage={stage}
			/>
			<group position={[x, y, z]}>
				<Particles season={grove.season} />
			</group>
			<SeasonTitle
				season={grove.season}
				label={grove.label}
				position={title}
				angle={toCamera(title)}
			/>
		</>
	);
}

const VERMILION = "#c4442b";

/** The stone approach: a pale gravel bed hugging the ground, stepping stones set in it. */
function Sando({
	at,
	length,
	heading,
}: {
	at: (t: number, offset?: number) => [number, number, number];
	length: number;
	heading: (t: number) => number;
}) {
	const { gravel, stones } = useMemo(() => {
		const steps = Math.ceil(length / 1.5);
		const positions: number[] = [];
		const index: number[] = [];
		for (let i = 0; i <= steps; i++) {
			for (const offset of [-1.9, 1.9]) {
				const [px, py, pz] = at(i / steps, offset);
				positions.push(px, py + 0.06, pz);
			}
			if (i < steps)
				index.push(
					i * 2,
					i * 2 + 1,
					i * 2 + 2,
					i * 2 + 1,
					i * 2 + 3,
					i * 2 + 2,
				);
		}
		const gravel = new BufferGeometry();
		gravel.setAttribute(
			"position",
			new BufferAttribute(new Float32Array(positions), 3),
		);
		gravel.setIndex(index);
		gravel.computeVertexNormals();
		const rand = random(3);
		const count = Math.floor(length / 1.15);
		const stones = new InstancedMesh(
			undefined,
			new MeshStandardMaterial({ color: "#9a968f", roughness: 1 }),
			count,
		);
		const m = new Matrix4();
		for (let i = 0; i < count; i++) {
			const t = (i + 0.5) / count;
			const [px, py, pz] = at(t, (rand() - 0.5) * 0.3);
			const size = 0.85 + rand() * 0.3;
			m.makeRotationY(heading(t) + (rand() - 0.5) * 0.25)
				.scale(new Vector3(size, 1, size))
				.setPosition(px, py + 0.12, pz);
			stones.setMatrixAt(i, m);
		}
		return { gravel, stones };
	}, [at, length, heading]);
	return (
		<>
			<mesh geometry={gravel}>
				<meshStandardMaterial color="#6e6c69" roughness={1} side={DoubleSide} />
			</mesh>
			<primitive object={stones} frustumCulled={false}>
				<boxGeometry attach="geometry" args={[1.9, 0.14, 0.8]} />
			</primitive>
		</>
	);
}

/** A vermilion torii marking the way in, its black kasagi capped with snow in winter. */
function Torii({ snow }: { snow: boolean }) {
	return (
		<group>
			{[-2.3, 2.3].map((px) => (
				<group key={px}>
					<mesh position={[px, 2.7, 0]}>
						<cylinderGeometry args={[0.2, 0.24, 5.4, 10]} />
						<meshStandardMaterial color={VERMILION} roughness={0.7} />
					</mesh>
					<mesh position={[px, 0.2, 0]}>
						<cylinderGeometry args={[0.32, 0.34, 0.4, 10]} />
						<meshStandardMaterial color="#26222a" roughness={0.9} />
					</mesh>
				</group>
			))}
			<mesh position={[0, 4.55, 0]}>
				<boxGeometry args={[5.6, 0.26, 0.26]} />
				<meshStandardMaterial color={VERMILION} roughness={0.7} />
			</mesh>
			<mesh position={[0, 5.45, 0]}>
				<boxGeometry args={[6.6, 0.32, 0.5]} />
				<meshStandardMaterial color={VERMILION} roughness={0.7} />
			</mesh>
			<mesh position={[0, 5.72, 0]}>
				<boxGeometry args={[7.2, 0.22, 0.62]} />
				<meshStandardMaterial color="#1e1b20" roughness={0.8} />
			</mesh>
			{snow && (
				<mesh position={[0, 5.9, 0]}>
					<boxGeometry args={[7, 0.16, 0.58]} />
					<meshStandardMaterial color="#f2f5fa" roughness={1} />
				</mesh>
			)}
		</group>
	);
}

/** The little shrine the sandō leads to, a warm light in its open front. */
function Hokora({ snow }: { snow: boolean }) {
	return (
		<group>
			<mesh position={[0, 0.35, 0]}>
				<boxGeometry args={[3, 0.7, 2.6]} />
				<meshStandardMaterial {...stone} />
			</mesh>
			<mesh position={[0, 1.6, 0]}>
				<boxGeometry args={[1.8, 1.8, 1.6]} />
				<meshStandardMaterial {...wood} />
			</mesh>
			<mesh position={[0, 1.55, 0.81]}>
				<planeGeometry args={[1.1, 1.2]} />
				<meshBasicMaterial color="#ffcf8f" toneMapped={false} />
			</mesh>
			<Halo color="#ffcf8f" size={5} y={1.6} />
			{[-1, 1].map((s) => (
				<mesh key={s} position={[s * 0.62, 2.85, 0]} rotation-z={-s * 0.62}>
					<boxGeometry args={[1.6, 0.12, 2.3]} />
					<meshStandardMaterial
						color={snow ? "#eef2f8" : "#3a3236"}
						roughness={0.9}
					/>
				</mesh>
			))}
		</group>
	);
}

/** A knee-high stone lantern along the approach. */
function StoneLantern() {
	return (
		<group>
			<mesh position={[0, 0.5, 0]}>
				<cylinderGeometry args={[0.16, 0.24, 1, 6]} />
				<meshStandardMaterial {...stone} />
			</mesh>
			<mesh position={[0, 1.2, 0]}>
				<boxGeometry args={[0.55, 0.45, 0.55]} />
				<meshBasicMaterial color="#ffd9a0" toneMapped={false} />
			</mesh>
			<mesh position={[0, 1.55, 0]} rotation-y={Math.PI / 4}>
				<coneGeometry args={[0.6, 0.35, 4]} />
				<meshStandardMaterial {...stone} />
			</mesh>
			<Halo color="#ffd9a0" size={2.6} y={1.2} />
		</group>
	);
}

function Halo({ color, size, y }: { color: string; size: number; y: number }) {
	const map = useMemo(glowTexture, []);
	return (
		<mesh position={[0, y, -0.3]}>
			<planeGeometry args={[size, size]} />
			<meshBasicMaterial
				map={map}
				color={color}
				transparent
				opacity={0.45}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</mesh>
	);
}

const stone = { color: "#8f9097", roughness: 1 } as const;
const wood = { color: "#7a5236", roughness: 0.9 } as const;

/** The trees of every grove: a half ring behind each one, its front left open toward the visitor. */
function GroveTrees({ seasons }: { seasons: HallSeason[] }) {
	const [meshes, setMeshes] = useState<InstancedMesh[]>([]);
	useEffect(() => {
		gltfLoader().load("/models/2026/trees.glb", (gltf) => {
			gltf.scene.updateMatrixWorld(true);
			const built: InstancedMesh[] = [];
			const m = new Matrix4();
			const groves = seasons.slice(0, 4);
			// Every tree and bush to plant, keyed by season and model.
			const spots = new Map<string, Matrix4[]>();
			const plant = (
				season: Kind,
				name: string,
				x: number,
				z: number,
				size: number,
				turn: number,
			) => {
				const key = `${season}:${name}`;
				m.makeRotationY(turn)
					.scale(new Vector3(size, size, size))
					.setPosition(x, hallHeight(x, z) - 0.2, z);
				spots.set(key, [...(spots.get(key) ?? []), m.clone()]);
			};

			// Each sandō is an avenue: the season's trees line it on both sides behind its props, all the way
			// up into the mountain. On the side facing the visitor the first stretch keeps to bushes, so the
			// nearest trees never wall off the view.
			const avenues = groves.map(({ items }, index) =>
				sando(index, sandoLength(items.length)),
			);
			groves.forEach(({ season, items }, index) => {
				const side = index % 2 === 0 ? -1 : 1;
				const kind = GROVE_TREES[season];
				const rand = random(17 + index * 101);
				const slots = propSlots(index, items.length);
				const path = avenues[index] as (typeof avenues)[number];
				for (let d = 3; d < path.length; d += 5.5 + rand() * 2) {
					for (const outer of [false, true]) {
						const offset = (outer ? side : -side) * (9.5 + rand() * 3);
						const [tx, tz] = path.at(d / path.length, offset);
						const bush = outer && d < 18;
						const name = bush
							? rand() < 0.5
								? "bush_1"
								: "bush_2"
							: (kind.names[Math.floor(rand() * kind.names.length)] as string);
						const size = 0.8 + rand() * 0.45;
						const turn = rand() * 6.3;
						// Never on the platform or by the rails, where the avenue starts.
						if (Math.abs(tx - TRAIN.x) < 16) continue;
						if (
							slots.some((slot) => Math.hypot(slot.x - tx, slot.z - tz) < 3.2)
						)
							continue;
						plant(season, name, tx, tz, size, turn);
					}
				}
			});

			// Between and around the avenues: woods and bushes of the nearest season, mingling where two meet,
			// so the basin is full and one season melts into the next. Kept clear only where trees would hide
			// something: the track and platform, the avenues and their props, and the ground right in front of
			// each stop's camera, where a tree would fill the screen.
			const rand = random(5);
			const last = grovePlacement(groves.length - 1).z;
			const taken = groves.flatMap((g, i) => propSlots(i, g.items.length));
			const cameras = groves.map(
				(_, i) => cameraStage(grovePlacement(i).stage).position,
			);
			const distanceTo = (x: number, z: number, i: number) => {
				const { entrance, shrine } = avenues[i] as (typeof avenues)[number];
				const [ax, az] = entrance;
				const [bx, bz] = shrine;
				const t = Math.max(
					0,
					Math.min(
						1,
						((x - ax) * (bx - ax) + (z - az) * (bz - az)) /
							((bx - ax) ** 2 + (bz - az) ** 2),
					),
				);
				return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t);
			};
			for (let n = 0; n < 480; n++) {
				const side = rand() < 0.5 ? -1 : 1;
				const lateral = 16 + 54 * rand() ** 1.15;
				const x = TRAIN.x + side * lateral;
				const z = -(
					CLEARING_START -
					15 +
					rand() * (-last - CLEARING_START + 85)
				);
				const bush = rand() < 0.45;
				const pick = rand();
				const size = 0.75 + rand() * 0.55;
				const turn = rand() * 6.3;
				const mingle = rand();
				const fade = rand();
				if (taken.some((slot) => Math.hypot(slot.x - x, slot.z - z) < 3.5))
					continue;
				const reach = groves.map((_, i) => distanceTo(x, z, i));
				const order = reach
					.map((_, i) => i)
					.sort((p, q) => (reach[p] as number) - (reach[q] as number));
				const [first, second] = order as [number, number];
				const fromAvenue = reach[first] as number;
				if (fromAvenue < 9) continue;
				const foreground = cameras.some(
					([, , cz]) => z < cz + 8 && z > cz - 34 && lateral < 24,
				);
				if (foreground) continue;
				// Where two avenues are about as near, their seasons mingle.
				const close =
					second !== undefined && (reach[second] as number) - fromAvenue < 18;
				const owner = close && mingle < 0.4 ? second : first;
				// Far from every avenue the valley's dark pines take over.
				const evergreen = !bush && fade < (fromAvenue - 30) / 30;
				const season: Kind = evergreen
					? "evergreen"
					: (groves[owner] as HallSeason).season;
				const kind = kindOf(season);
				const name = bush
					? pick < 0.5
						? "bush_1"
						: "bush_2"
					: (kind.names[Math.floor(pick * kind.names.length)] as string);
				plant(season, name, x, z, size, turn);
			}

			for (const [key, items] of spots) {
				const [season, name] = key.split(":") as [Kind, string];
				const kind = kindOf(season);
				const bush = name.startsWith("bush");
				// Winter bushes stay bare like the deciduous trees; others take the season's tint.
				const tint = bush && season === "winter" ? undefined : kind.tint;
				const parts = [
					["branches", barkMaterial(bush ? "oak" : kind.bark)],
					[
						"leaves",
						tint ? leafMaterial(bush ? "oak" : kind.leaf, tint) : undefined,
					],
				] as const;
				for (const [part, material] of parts) {
					const node = gltf.scene.getObjectByName(`${name}_${part}`);
					if (!(node instanceof Mesh) || !material) continue;
					const mesh = new InstancedMesh(node.geometry, material, items.length);
					items.forEach((spot, k) => {
						mesh.setMatrixAt(k, spot.clone().multiply(node.matrixWorld));
					});
					mesh.computeBoundingSphere();
					built.push(mesh);
				}
			}
			setMeshes(built);
		});
	}, [seasons]);
	return (
		<>
			{meshes.map((mesh) => (
				<primitive key={mesh.uuid} object={mesh} />
			))}
		</>
	);
}

const KANJI: Record<Season, string> = {
	winter: "冬",
	spring: "春",
	summer: "夏",
	fall: "秋",
};
const seasonFont = (size: number) =>
	`800 ${size}px "Shippori Mincho B1", serif`;

/** The season written into the landscape, as on the line: a tall kanji over its name, over its torii. */
function SeasonTitle({
	season,
	label,
	position,
	angle,
}: {
	season: Season;
	label: string;
	position: [number, number, number];
	angle: number;
}) {
	const [texture, setTexture] = useState<CanvasTexture>();
	useEffect(() => {
		let cancelled = false;
		document.fonts
			.load(seasonFont(320), KANJI[season] + label)
			.catch(() => undefined)
			.then(() => {
				if (cancelled) return;
				const canvas = document.createElement("canvas");
				canvas.width = canvas.height = 1024;
				const g = canvas.getContext("2d") as CanvasRenderingContext2D;
				g.textAlign = "center";
				g.fillStyle = "#fffaf0";
				g.font = seasonFont(560);
				g.fillText(KANJI[season], 512, 690);
				// Long names (PRINTEMPS, AUTOMNE…) shrink to fit instead of being cut off.
				const name = label.toUpperCase();
				g.letterSpacing = "18px";
				for (let size = 150; size >= 60; size -= 6) {
					g.font = seasonFont(size);
					if (g.measureText(name).width <= 960) break;
				}
				g.fillText(name, 512, 900);
				const result = new CanvasTexture(canvas);
				result.colorSpace = SRGBColorSpace;
				setTexture(result);
			});
		return () => {
			cancelled = true;
		};
	}, [season, label]);
	if (!texture) return null;
	// Over the torii, by the track, its base just above the horizon line so no prop or tree behind shows through.
	return (
		<mesh position={position} rotation-y={angle}>
			<planeGeometry args={[9, 9]} />
			<meshBasicMaterial
				map={texture}
				transparent
				opacity={0.92}
				depthWrite={false}
			/>
		</mesh>
	);
}

const PARTICLES = 220;

function Particles({ season }: { season: Season }) {
	const settings = GROVE_PARTICLES[season];
	const { geometry, material } = useMemo(() => {
		const rand = random(7);
		const positions = new Float32Array(PARTICLES * 3);
		const seeds = new Float32Array(PARTICLES * 3);
		for (let i = 0; i < PARTICLES; i++) {
			positions.set(
				[(rand() - 0.5) * 30, rand() * 14, (rand() - 0.5) * 30],
				i * 3,
			);
			seeds.set([rand(), rand(), rand()], i * 3);
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new BufferAttribute(positions, 3));
		geometry.setAttribute("aSeed", new BufferAttribute(seeds, 3));
		const material = new ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: season === "summer" ? AdditiveBlending : undefined,
			uniforms: {
				uTime: { value: 0 },
				uColor: { value: new Color(settings.color) },
				uFall: { value: settings.fall },
				uSway: { value: settings.sway },
				uSize: { value: settings.size },
			},
			vertexShader: /* glsl */ `
				uniform float uTime, uFall, uSway, uSize;
				attribute vec3 aSeed;
				void main() {
					vec3 p = position;
					p.y = mod(p.y - uTime * uFall * (0.6 + aSeed.x), 14.0);
					p.x += sin(uTime * (0.4 + aSeed.y) + aSeed.z * 6.2831) * uSway;
					p.z += cos(uTime * (0.3 + aSeed.x) + aSeed.y * 6.2831) * uSway * 0.6;
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					gl_PointSize = uSize * (0.6 + aSeed.y) * 220.0 / -mv.z;
					gl_Position = projectionMatrix * mv;
				}
			`,
			fragmentShader: /* glsl */ `
				uniform vec3 uColor;
				void main() {
					float d = length(gl_PointCoord - 0.5);
					float alpha = smoothstep(0.5, 0.15, d) * 0.9;
					if (alpha < 0.01) discard;
					gl_FragColor = vec4(uColor, alpha);
					#include <colorspace_fragment>
				}
			`,
		});
		return { geometry, material };
	}, [season, settings]);
	useFrame(({ clock }) => {
		material.uniforms.uTime.value = clock.elapsedTime;
	});
	return (
		<points geometry={geometry} material={material} frustumCulled={false} />
	);
}
