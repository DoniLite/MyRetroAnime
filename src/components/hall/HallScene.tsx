import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	AdditiveBlending,
	Box3,
	BufferAttribute,
	BufferGeometry,
	Color,
	DefaultLoadingManager,
	FogExp2,
	type Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	PerspectiveCamera,
	RepeatWrapping,
	ShaderMaterial,
	SRGBColorSpace,
	TextureLoader,
	Vector3,
} from "three";
import type { Season } from "../../lib/seasons";
import { PALETTES } from "../../years/2026/palette";
import { terrainFragment, terrainVertex } from "../../years/2026/shaders";
import { fbm, smoothstep } from "../../years/2026/terrain";
import { barkMaterial, leafMaterial } from "../../years/2026/Vegetation";
import { gltfLoader, reportProgress } from "../loading";
import { Crossing } from "./Crossing";
import { Groves, type HallSeason } from "./Groves";
import { Horizon } from "./Horizon";
import {
	CLEARING_START,
	cameraStage,
	crossingZ,
	grovePlacement,
	hallHeight,
	PLATFORM,
	SNOW_LINE,
	TRACK_END,
	TRAIN,
	trainRun,
} from "./layout";
import { glowTexture } from "./shared";
import { Woods } from "./Woods";

/**
 * The hall: a country terminus at blue hour, shared by every giga season. The track runs away from the
 * viewer through a forest corridor toward a gap in the mountains. Scrolling dives along it, behind the
 * train, into a clearing where the current year's seasons stand as groves, two on each side.
 */

/** CC-BY model, see public/models/hall/LICENSE.md. */
const TRAIN_URL = "/models/hall/kiha32.glb";
// The sky's horizon tone, so the haze melts the far ranges into it.
const HAZE = new Color("#4d5c9e");

/** Scroll position in stops (0 = platform, k = k-th pair of groves), shared by the camera and the train. */
const journey = { stage: 0, eased: 0 };
const trainZ = () => TRAIN.z - trainRun(journey.eased);
/** One level crossing per pair of groves; the platform opens for each. */
const CROSSINGS = [0, 1].map(crossingZ);

export default function HallScene({
	seasons,
	lineUrl,
}: {
	seasons: HallSeason[];
	lineUrl: string;
}) {
	const [loaded, setLoaded] = useState(false);
	const [canvasReady, setCanvasReady] = useState(false);

	useEffect(() => {
		// The scene's code has arrived: the watchdog now waits on its assets.
		reportProgress(0);
		// A file that fails means a broken valley: show the 2D hall rather than reveal it half-built.
		let failed = false;
		DefaultLoadingManager.onError = () => {
			failed = true;
		};
		DefaultLoadingManager.onLoad = () =>
			failed
				? document.documentElement.classList.remove("has-3d", "scene-loading")
				: setLoaded(true);
		DefaultLoadingManager.onProgress = (_, loaded, total) =>
			reportProgress(loaded / total);
		return () => {
			DefaultLoadingManager.onLoad = () => {};
			DefaultLoadingManager.onError = () => {};
			DefaultLoadingManager.onProgress = () => {};
		};
	}, []);

	useEffect(() => {
		if (!loaded || !canvasReady) return;
		// Two frames: shaders compiled and textures uploaded before the hall fades in.
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				document.documentElement.classList.remove("scene-loading"),
			),
		);
	}, [loaded, canvasReady]);

	return (
		<Canvas
			dpr={[1, 1.5]}
			camera={{
				fov: 52,
				position: [...cameraStage(0).position],
				near: 0.1,
				far: 2400,
			}}
			// Pointer events on: the groves and their props are clickable.
			style={{ position: "fixed", inset: 0, zIndex: 0 }}
			className="scene-canvas"
			onCreated={() => setCanvasReady(true)}
			aria-hidden
		>
			<Hall seasons={seasons} lineUrl={lineUrl} />
		</Canvas>
	);
}

function Hall({
	seasons,
	lineUrl,
}: {
	seasons: HallSeason[];
	lineUrl: string;
}) {
	const scene = useThree((state) => state.scene);
	const seasonNames = useMemo(() => seasons.map((s) => s.season), [seasons]);
	const counts = useMemo(
		() => seasons.slice(0, 4).map((s) => s.items.length),
		[seasons],
	);
	useEffect(() => {
		scene.fog = new FogExp2(HAZE, HALL_HAZE_DENSITY);
		return () => {
			scene.fog = null;
		};
	}, [scene]);

	return (
		<>
			<hemisphereLight args={["#7f8fc4", "#20243a", 0.9]} />
			<directionalLight
				position={[-30, 25, -60]}
				intensity={0.7}
				color="#ffc9a0"
			/>
			<CameraRig />
			<Sky />
			<Terrain seasons={seasonNames} />
			<Forest />
			<Track />
			<Platform />
			<Horizon />
			{CROSSINGS.map((z) => (
				<Crossing key={z} z={z} trainZ={trainZ} />
			))}
			<Train />
			<Woods counts={counts} />
			<Groves seasons={seasons} lineUrl={lineUrl} stage={() => journey.stage} />
		</>
	);
}

const DEG = Math.PI / 180;
const from = new Vector3();
const to = new Vector3();
const look = new Vector3();

/** Reads the scroll and glides the camera from stop to stop: the platform, then each pair of groves. */
function CameraRig() {
	useFrame(({ camera, size }, delta) => {
		// Portrait screens widen the view so both sides of the clearing (and the groves) stay in frame.
		if (camera instanceof PerspectiveCamera) {
			const needed =
				(2 * Math.atan(Math.tan((68 / 2) * DEG) / (size.width / size.height))) /
				DEG;
			const fov = Math.min(95, Math.max(52, needed));
			if (camera.fov !== fov) {
				camera.fov = fov;
				camera.updateProjectionMatrix();
			}
		}
		// Every stop is one scroll-snapped screen: the scroll reads directly as a stage.
		const screen =
			document.querySelector<HTMLElement>(".screen")?.offsetHeight ||
			innerHeight;
		const last = document.querySelectorAll(".screen").length - 1;
		const target = Math.min(last, Math.max(0, scrollY / screen));
		journey.stage += (target - journey.stage) * (1 - Math.exp(-delta * 2.5));
		const stage = Math.floor(journey.stage);
		journey.eased = stage + smoothstep(0, 1, journey.stage - stage);
		const a = cameraStage(stage);
		const b = cameraStage(stage + 1);
		const t = journey.eased - stage;
		camera.position.lerpVectors(
			from.fromArray(a.position),
			to.fromArray(b.position),
			t,
		);
		look.lerpVectors(from.fromArray(a.target), to.fromArray(b.target), t);
		camera.lookAt(look);
	});
	return null;
}

/** Blue hour: deep indigo overhead, a warm afterglow where the track meets the horizon, the moon, first stars. */
function Sky() {
	const material = useMemo(
		() =>
			new ShaderMaterial({
				depthWrite: false,
				depthTest: false,
				uniforms: { uTime: { value: 0 }, uAspect: { value: 1 } },
				vertexShader: /* glsl */ `
					varying vec2 vUv;
					void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
				`,
				fragmentShader: /* glsl */ `
					uniform float uTime, uAspect;
					varying vec2 vUv;
					float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
					void main() {
						vec3 top = vec3(0.07, 0.10, 0.24);
						vec3 mid = vec3(0.30, 0.36, 0.62);
						vec3 glow = vec3(1.0, 0.62, 0.42);
						float y = vUv.y;
						vec3 col = mix(mid, top, smoothstep(0.45, 1.0, y));
						float d = length((vUv - vec2(0.62, 0.38)) * vec2(1.6, 1.0));
						col = mix(col, glow, exp(-d * 4.0) * 0.75 * (1.0 - smoothstep(0.35, 0.8, y)));
						// A pale moon high on the right, with a soft halo; lower and smaller on portrait screens, clear of the title.
						bool portrait = uAspect < 1.0;
						float r = portrait ? 0.022 : 0.034;
						float m = length((vUv - (portrait ? vec2(0.8, 0.68) : vec2(0.8, 0.8))) * vec2(uAspect, 1.0));
						col += vec3(0.55, 0.6, 0.8) * exp(-m * 9.0) * 0.35;
						col = mix(col, vec3(0.96, 0.95, 0.9), smoothstep(r, r * 0.88, m));
						// Stars: one candidate per cell, a small round point at a random spot in it, most cells empty.
						vec2 grid = vUv * vec2(180.0, 100.0);
						vec2 cell = floor(grid);
						float seed = hash(cell);
						vec2 spot = vec2(hash(cell + 7.1), hash(cell + 3.7)) * 0.7 + 0.15;
						float radius = mix(0.05, 0.16, hash(cell + 1.3));
						float dot = smoothstep(radius, 0.0, length(fract(grid) - spot));
						float twinkle = 0.7 + 0.3 * sin(uTime * (0.8 + seed * 1.6) + seed * 40.0);
						float star = step(0.975, seed) * dot * twinkle * smoothstep(0.5, 0.9, y);
						col += vec3(0.95, 0.97, 1.0) * star * mix(0.35, 1.0, hash(cell + 9.2));
						gl_FragColor = vec4(col, 1.0);
						#include <colorspace_fragment>
					}
				`,
			}),
		[],
	);
	useFrame(({ clock, size }) => {
		material.uniforms.uTime.value = clock.elapsedTime;
		material.uniforms.uAspect.value = size.width / size.height;
	});
	return (
		<mesh frustumCulled={false} renderOrder={-1} material={material}>
			<planeGeometry args={[2, 2]} />
		</mesh>
	);
}

const HALL_HAZE_DENSITY = 0.0038;
const SUN_DIR = new Vector3(0.35, 0.16, -1).normalize();

function hallTerrain(seasons: Season[]) {
	const [x0, x1, columns, rows] = [-320, 320, 210, 120];
	// Each grove dresses the ground around it in its season: snow, spring green, summer green, fallen leaves.
	const groves = seasons.slice(0, 4).map((season, i) => {
		const { x, z } = grovePlacement(i);
		const ground =
			season === "winter" ? new Color("#8e9a8f") : PALETTES[season].ground;
		return {
			x,
			z,
			ground,
			snowLine: PALETTES[season].snowLine,
		};
	});
	const count = (columns + 1) * (rows + 1);
	const positions = new Float32Array(count * 3);
	const grass = new Float32Array(count * 3).fill(0);
	const rock = new Float32Array(count * 3);
	const snow = new Float32Array(count).fill(SNOW_LINE);
	const [g, r] = [new Color("#86ad62"), new Color("#a8a397")];
	const tint = new Color();
	for (let row = 0; row <= rows; row++) {
		const z = 10 - 560 * (row / rows) ** 1.6;
		for (let column = 0; column <= columns; column++) {
			const x = x0 + ((x1 - x0) * column) / columns;
			const v = row * (columns + 1) + column;
			positions.set([x, hallHeight(x, z), z], v * 3);
			tint.copy(g);
			for (const grove of groves) {
				const w = Math.exp(-((Math.hypot(x - grove.x, z - grove.z) / 32) ** 2));
				tint.lerp(grove.ground, w);
				snow[v] -= (SNOW_LINE - grove.snowLine) * w;
			}
			grass.set([tint.r, tint.g, tint.b], v * 3);
			rock.set([r.r, r.g, r.b], v * 3);
		}
	}
	const index: number[] = [];
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const p = row * (columns + 1) + column;
			const q = p + columns + 1;
			index.push(p, p + 1, q, p + 1, q + 1, q);
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("aGrass", new BufferAttribute(grass, 3));
	geometry.setAttribute("aRock", new BufferAttribute(rock, 3));
	geometry.setAttribute("aSnowLine", new BufferAttribute(snow, 1));
	geometry.setIndex(index);
	geometry.computeVertexNormals();
	return geometry;
}

function terrainTexture(name: string, color: boolean) {
	const texture = new TextureLoader().load(`/textures/2026/${name}.webp`);
	texture.wrapS = texture.wrapT = RepeatWrapping;
	texture.anisotropy = 8;
	if (color) texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** Textured rock, grass and snow under a low, backlighting dusk sun, fading into the blue haze. */
function Terrain({ seasons }: { seasons: Season[] }) {
	const geometry = useMemo(() => hallTerrain(seasons), [seasons]);
	const material = useMemo(
		() =>
			new ShaderMaterial({
				vertexShader: terrainVertex,
				fragmentShader: terrainFragment,
				uniforms: {
					uRock: { value: terrainTexture("rock_face_03_color", true) },
					uRockNormal: { value: terrainTexture("rock_face_03_normal", false) },
					uGrass: { value: terrainTexture("aerial_grass_rock_color", true) },
					uGrassNormal: {
						value: terrainTexture("aerial_grass_rock_normal", false),
					},
					uSnow: { value: terrainTexture("snow_02_color", true) },
					uSnowNormal: { value: terrainTexture("snow_02_normal", false) },
					uSun: { value: new Color("#ffb489").multiplyScalar(0.55) },
					uSunDir: { value: SUN_DIR },
					uSky: { value: new Color("#7d8cc7") },
					uGround: { value: new Color("#2a2a3c") },
					uFog: { value: HAZE },
					uFogDensity: { value: HALL_HAZE_DENSITY },
				},
			}),
		[],
	);
	return <mesh geometry={geometry} material={material} />;
}

/** Evergreen forests on the lower slopes, far enough away to read as texture through the haze. */
function Forest() {
	const [meshes, setMeshes] = useState<InstancedMesh[]>([]);
	useEffect(() => {
		gltfLoader().load("/models/2026/trees.glb", (gltf) => {
			gltf.scene.updateMatrixWorld(true);
			const names = ["pine_1", "pine_2", "pine_large_1"];
			const spots: Matrix4[][] = names.map(() => []);
			let seed = 11;
			const rand = () => {
				seed = (seed * 16807) % 2147483647;
				return seed / 2147483647;
			};
			const m = new Matrix4();
			// ~250 detailed trees (~8k triangles each) near the track; the far slopes are Woods' pine cards.
			for (let n = 0; n < 500; n++) {
				let x: number;
				let z: number;
				if (n % 2) {
					// The corridor: woods lining the track from the station into the valley, opening out into
					// the clearing instead of stopping dead, until they meet the woods on the slopes.
					z = -(52 + rand() * (CLEARING_START + 70 - 52));
					// A cleared right-of-way: canopies (~4 m wide) stay clear of the platform and the rails.
					const opening = Math.max(0, -z - CLEARING_START) * 0.7;
					const clearance = 16 + -z * 0.04 + opening;
					x =
						TRAIN.x +
						(rand() < 0.5 ? -1 : 1) * (clearance + 38 * rand() ** 1.5);
				} else {
					// Forests climbing the foot of the mountain sides.
					z = -(120 + rand() * 220);
					x = TRAIN.x + (rand() - 0.5) * 520;
					const side = Math.abs(x - TRAIN.x) / (60 + -z * 0.3);
					if (side < 0.45 || side > 1.6) continue;
				}
				const y = hallHeight(x, z);
				const slope = Math.abs(hallHeight(x + 1, z) - hallHeight(x - 1, z)) / 2;
				if (y > SNOW_LINE - 25 || slope > 1.3) continue;
				// The corridor is a continuous curtain on both sides; the slopes get woods in patches.
				if (n % 2 === 0 && fbm(x * 0.02, z * 0.02, 3) < 0.48) continue;
				const size = 0.8 + rand() * 0.6;
				m.makeRotationY(rand() * Math.PI * 2)
					.scale(new Vector3(size, size, size))
					.setPosition(x, y - 0.2, z);
				spots[Math.floor(rand() * names.length)]?.push(m.clone());
			}
			const built: InstancedMesh[] = [];
			names.forEach((name, i) => {
				const items = spots[i] ?? [];
				for (const [part, material] of [
					["branches", barkMaterial("pine")],
					["leaves", leafMaterial("pine", "#4f6f4a")],
				] as const) {
					const node = gltf.scene.getObjectByName(`${name}_${part}`);
					if (!(node instanceof Mesh) || items.length === 0) continue;
					const mesh = new InstancedMesh(node.geometry, material, items.length);
					items.forEach((spot, k) => {
						mesh.setMatrixAt(k, spot.clone().multiply(node.matrixWorld));
					});
					mesh.computeBoundingSphere();
					built.push(mesh);
				}
			});
			setMeshes(built);
		});
	}, []);
	return (
		<>
			{meshes.map((mesh) => (
				<primitive key={mesh.uuid} object={mesh} />
			))}
		</>
	);
}

/** Rails on sleepers, running straight to the horizon. */
function Track() {
	const sleepers = useMemo(() => {
		const count = Math.ceil((8 - TRACK_END) / 0.9);
		const mesh = new InstancedMesh(
			undefined,
			new MeshStandardMaterial({ color: "#3a2f2a", roughness: 1 }),
			count,
		);
		const matrix = new Matrix4();
		for (let i = 0; i < count; i++)
			mesh.setMatrixAt(i, matrix.makeTranslation(TRAIN.x, 0.08, 8 - i * 0.9));
		return mesh;
	}, []);
	return (
		<group>
			<primitive object={sleepers} frustumCulled={false}>
				<boxGeometry attach="geometry" args={[2.4, 0.12, 0.24]} />
			</primitive>
			{/* Ballast bed under the sleepers. */}
			<mesh position={[TRAIN.x, 0.02, (8 + TRACK_END) / 2]}>
				<boxGeometry args={[3.4, 0.08, 8 - TRACK_END]} />
				<meshStandardMaterial color="#45413c" roughness={1} />
			</mesh>
			{[-0.55, 0.55].map((offset) => (
				<mesh
					key={offset}
					position={[TRAIN.x + offset, 0.22, (8 + TRACK_END) / 2]}
				>
					<boxGeometry args={[0.07, 0.12, 8 - TRACK_END]} />
					<meshStandardMaterial
						color="#9aa3b5"
						metalness={0.8}
						roughness={0.35}
					/>
				</mesh>
			))}
		</group>
	);
}

/** One platform lamp: post, light bar and halo. The same model lines the platform and the path. */
function Lamp({
	position,
	light,
}: {
	position: [number, number, number];
	light?: boolean;
}) {
	const glow = useMemo(() => glowTexture(), []);
	return (
		<group position={position}>
			<mesh position={[0, 1.7, 0]}>
				<boxGeometry args={[0.08, 3.4, 0.08]} />
				<meshStandardMaterial color="#2b2f3d" />
			</mesh>
			<mesh position={[0.45, 3.35, 0]}>
				<boxGeometry args={[1, 0.08, 0.16]} />
				<meshBasicMaterial color="#ffe9c4" />
			</mesh>
			<mesh position={[0.45, 3.2, 0]}>
				<planeGeometry args={[4.5, 4.5]} />
				<meshBasicMaterial
					map={glow}
					color="#ffcf8f"
					transparent
					opacity={0.35}
					depthWrite={false}
					blending={AdditiveBlending}
				/>
			</mesh>
			{/* A warm pool of light on the ground under it. */}
			<mesh position={[0.45, 0.02, 0]} rotation-x={-Math.PI / 2}>
				<planeGeometry args={[5, 5]} />
				<meshBasicMaterial
					map={glow}
					color="#ffcf8f"
					transparent
					opacity={0.18}
					depthWrite={false}
					blending={AdditiveBlending}
				/>
			</mesh>
			{/* Only a few lamps light the scene for real; the rest are halos, which cost nothing. */}
			{light && (
				<pointLight
					position={[0.6, 3.1, 0]}
					color="#ffcf8f"
					intensity={5}
					distance={9}
					decay={1.6}
				/>
			)}
		</group>
	);
}

/**
 * Concrete platform with its tactile strip and its lamps, running beside the track all the way into the
 * valley. At each level crossing it ramps down to the road and back up.
 */
function Platform() {
	const start = 8;
	const end = start - PLATFORM.length;
	const left = PLATFORM.edge - PLATFORM.width;
	const centre = left + PLATFORM.width / 2;
	const gap = 3.5; // half the opening: the 5 m road plus a margin
	const ramp = 4;
	// Solid stretches between the crossings' openings (each ends where its ramps begin).
	const cuts = [...CROSSINGS].sort((a, b) => b - a);
	const stretches: [number, number][] = [];
	let from = start;
	for (const z of cuts) {
		stretches.push([from, z + gap + ramp]);
		from = z - gap - ramp;
	}
	stretches.push([from, end]);
	// From just ahead of the viewer along the platform; none behind the camera's shoulder, none at the openings.
	const lamps = useMemo(
		() =>
			Array.from(
				{ length: Math.floor((PLATFORM.length - 8) / 12) + 1 },
				(_, i) => -4 - i * 12,
			).filter((z) => CROSSINGS.every((c) => Math.abs(z - c) > gap + ramp + 1)),
		[],
	);
	const slope = Math.atan2(PLATFORM.top, ramp);
	return (
		<group>
			{stretches.map(([a, b]) => (
				<group key={a}>
					<mesh position={[centre, PLATFORM.top / 2, (a + b) / 2]}>
						<boxGeometry args={[PLATFORM.width, PLATFORM.top, a - b]} />
						<meshStandardMaterial color="#6b6f7c" roughness={0.95} />
					</mesh>
					<mesh
						position={[PLATFORM.edge - 0.45, PLATFORM.top + 0.005, (a + b) / 2]}
					>
						<boxGeometry args={[0.3, 0.01, a - b]} />
						<meshStandardMaterial color="#d8b23a" roughness={0.8} />
					</mesh>
				</group>
			))}
			{cuts.flatMap((z) =>
				[1, -1].map((dir) => (
					<mesh
						key={`${z}${dir}`}
						position={[centre, PLATFORM.top / 2, z + dir * (gap + ramp / 2)]}
						rotation-x={-dir * slope}
					>
						<boxGeometry
							args={[PLATFORM.width, 0.1, Math.hypot(ramp, PLATFORM.top)]}
						/>
						<meshStandardMaterial color="#6b6f7c" roughness={0.95} />
					</mesh>
				)),
			)}
			{lamps.map((z, index) => (
				<Lamp
					key={z}
					position={[left + 1.2, PLATFORM.top, z]}
					light={index < 3}
				/>
			))}
		</group>
	);
}

/** The KiHa 32 at the platform: loaded, laid along the track and scaled to a real railcar. */
function Train() {
	const group = useRef<Group>(null);
	const [model, setModel] = useState<Object3D>();
	const departing = useRef<number | null>(null);

	useEffect(() => {
		gltfLoader().load(
			TRAIN_URL,
			(gltf) => {
				const train = gltf.scene;
				const size = new Box3().setFromObject(train).getSize(new Vector3());
				// Models come in any orientation: lay the longest horizontal axis along the track.
				if (size.x > size.z) train.rotation.y = Math.PI / 2;
				const box = new Box3().setFromObject(train);
				const length = Math.max(size.x, size.z);
				train.scale.setScalar(TRAIN.length / length);
				box.setFromObject(train);
				const center = box.getCenter(new Vector3());
				train.position.sub(new Vector3(center.x, box.min.y, center.z));
				setModel(train);
			},
			undefined,
			() => {},
		);
		const depart = () => {
			departing.current = performance.now();
		};
		addEventListener("hall:depart", depart);
		return () => removeEventListener("hall:depart", depart);
	}, []);

	useFrame(() => {
		if (!group.current) return;
		// Runs ahead of the diving camera into the clearing; on departure, pulls away and gathers speed.
		const run = trainRun(journey.eased);
		const t =
			departing.current === null
				? 0
				: (performance.now() - departing.current) / 1000;
		group.current.position.z = TRAIN.z - run - 9 * t * t;
	});

	if (!model) return null;
	return (
		<group ref={group} position={[TRAIN.x, TRAIN.railTop, TRAIN.z]}>
			<primitive object={model} />
		</group>
	);
}
