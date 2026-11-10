import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	Color,
	DefaultLoadingManager,
	DirectionalLight,
	FogExp2,
	HemisphereLight,
	InstancedMesh,
	Matrix4,
	MeshStandardMaterial,
	PerspectiveCamera,
	RepeatWrapping,
	ShaderMaterial,
	type ShaderMaterialParameters,
	SRGBColorSpace,
	TextureLoader,
} from "three";
import { reportProgress } from "../../components/loading";
import type { SceneProps, Stop } from "../types";
import { SpeedBlur } from "./Cabin";
import year from "./index";
import { blendInto, createPalette, type Palette } from "./palette";
import * as glsl from "./shaders";
import {
	buildTerrain,
	FOG_DENSITY,
	GROUND_Y,
	heightAt,
	random,
	riverAt,
	SPACING,
	SUN_DIRECTION,
	seasonsAt,
	TRACK_EDGE_Z,
	WATER_Y,
} from "./terrain";
import { Forest, Grass } from "./Vegetation";

// Tilted up a little, like a passenger's gaze out of the window: more sky, less ballast.
const CAMERA = { y: 1.2, z: 10, fov: 50, maxFov: 100, tilt: 0.1 };
/** Narrow screens widen the vertical FOV until this much of a station fits across. */
// Wide enough for the platform's canopy on a phone held upright, without the view turning into ballast.
const MIN_HORIZONTAL_FOV = 40;
const ACCENT = year.theme["--accent"];

/** Half the visible height at a given depth, to size cards so they always fill the window. */
function halfHeightAt(z: number) {
	return Math.tan(((CAMERA.maxFov / 2) * Math.PI) / 180) * (CAMERA.z - z);
}

/**
 * Scroll position as a fractional stop index (0 = intro, n-1 = last stop). Measured against a real
 * stop (100svh in YearLine), not the window: on phones innerHeight changes as the browser bars slide.
 */
function scrollProgress(count: number) {
	const stop =
		document.querySelector<HTMLElement>(".stop")?.offsetHeight || innerHeight;
	return Math.min(count - 1, Math.max(0, scrollY / stop));
}

const toRadians = Math.PI / 180;

function fovFor(aspect: number) {
	const needed =
		(2 * Math.atan(Math.tan((MIN_HORIZONTAL_FOV / 2) * toRadians) / aspect)) /
		toRadians;
	return Math.min(CAMERA.maxFov, Math.max(CAMERA.fov, needed));
}

export default function Scene({ stops, onReady, onFail }: SceneProps) {
	const [assetsLoaded, setAssetsLoaded] = useState(false);
	const [fontsLoaded, setFontsLoaded] = useState(false);
	const [canvasReady, setCanvasReady] = useState(false);

	// Every model and texture goes through three's default loading manager; it reports when the queue
	// drains. Subscribed before the canvas renders its children, so no load can finish unseen.
	// A failed asset means a broken landscape: hand over to the 2D line instead of revealing it.
	useLayoutEffect(() => {
		let failed = false;
		DefaultLoadingManager.onError = () => {
			failed = true;
		};
		DefaultLoadingManager.onLoad = () =>
			failed ? onFail?.() : setAssetsLoaded(true);
		DefaultLoadingManager.onProgress = (_, loaded, total) =>
			reportProgress(loaded / total);
		return () => {
			DefaultLoadingManager.onLoad = () => {};
			DefaultLoadingManager.onError = () => {};
			DefaultLoadingManager.onProgress = () => {};
		};
	}, [onFail]);

	// The season titles are drawn with the display font: wait for it so they never pop in late.
	useEffect(() => {
		const text = stops
			.map((stop) =>
				stop.kind === "season" ? KANJI[stop.season] + stop.label : "",
			)
			.join("");
		document.fonts
			.load(seasonFont(320), text)
			.catch(() => undefined)
			.then(() => setFontsLoaded(true));
	}, [stops]);

	useEffect(() => {
		if (!assetsLoaded || !fontsLoaded || !canvasReady) return;
		// Two frames: the first uploads the new textures and compiles shaders, the second is what is seen.
		requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()));
	}, [assetsLoaded, fontsLoaded, canvasReady, onReady]);

	return (
		<Canvas
			dpr={[1, 1.5]}
			camera={{
				fov: CAMERA.fov,
				position: [0, CAMERA.y, CAMERA.z],
				rotation: [CAMERA.tilt, 0, 0],
				near: 0.1,
				far: 1000,
			}}
			style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
			className="scene-canvas"
			onCreated={() => setCanvasReady(true)}
			aria-hidden
		>
			<Line stops={stops} />
		</Canvas>
	);
}

function Line({ stops }: SceneProps) {
	const motion = useMemo(() => ({ velocity: 0, lean: 0 }), []);
	const palette = useMemo(createPalette, []);
	const shared = useMemo(() => createShared(palette), [palette]);
	const started = useRef(false);
	const length = (stops.length - 1) * SPACING;

	useFrame(({ camera, clock, size }, delta) => {
		const fov = fovFor(size.width / size.height);
		if (camera instanceof PerspectiveCamera && camera.fov !== fov) {
			camera.fov = fov;
			camera.updateProjectionMatrix();
		}
		const target = scrollProgress(stops.length);
		const current = (camera.position.x - motion.lean) / SPACING;
		// First frame jumps straight to the scroll position (deep links), then eases like a train.
		const next = started.current
			? current + (target - current) * (1 - Math.exp(-delta * 2.5))
			: target;
		started.current = true;

		const speed = Math.min(1, Math.abs(target - next) * 3);
		// On board: the car leans forward as it brakes and settles back, rolls gently, hums with speed and
		// knocks at every rail joint.
		const velocity = (next - current) / Math.max(delta, 1e-3);
		const braking = Math.max(
			-1,
			Math.min(
				1,
				(Math.abs(motion.velocity) - Math.abs(velocity)) /
					Math.max(delta, 1e-3),
			),
		);
		motion.velocity = velocity;
		motion.lean +=
			(braking * Math.sign(velocity || 1) * 0.35 - motion.lean) *
			(1 - Math.exp(-delta * 3));
		const time = clock.elapsedTime;
		const joint = (next * SPACING) / 25;
		const knock = Math.exp(-(joint - Math.floor(joint)) * 30) * 0.025 * speed;
		camera.position.x = next * SPACING + motion.lean;
		camera.position.y =
			CAMERA.y + Math.sin(time * 17) * 0.012 * (0.2 + speed) + knock;
		camera.rotation.z = Math.sin(time * 0.9) * 0.005 * (0.15 + speed);
		shared.uSpeed.value +=
			(speed - shared.uSpeed.value) * (1 - Math.exp(-delta * 4));

		const { from, to, t } = seasonsAt(stops, next);
		blendInto(palette, from, to, t);
		shared.uHaze.value.lerpColors(palette.skyBottom, palette.skyTop, 0.3);
		shared.uProgress.value = next;

		shared.uTime.value = clock.elapsedTime;
		shared.uCamX.value = camera.position.x;
		shared.uAspect.value = size.width / size.height;
		shared.uFallSpeed.value = palette.fallSpeed;
		shared.uSway.value = palette.sway;
		shared.uSize.value = palette.size;
		shared.uOpacity.value = palette.opacity;
	});

	return (
		<>
			<Sky palette={palette} shared={shared} />
			<Atmosphere palette={palette} shared={shared} />
			<Terrain
				stops={stops}
				length={length}
				palette={palette}
				shared={shared}
			/>
			<Track length={length} />
			<River palette={palette} shared={shared} length={length} />
			<Forest stops={stops} length={length} />
			<Grass stops={stops} length={length} shared={shared} />
			{stops.map(
				(stop, i) =>
					stop.kind === "station" && (
						<Station
							key={stop.slug}
							x={i * SPACING}
							stop={stop}
							previous={stops.slice(0, i).findLast(isStation)}
							next={stops.slice(i + 1).find(isStation)}
							palette={palette}
						/>
					),
			)}
			{stops.map(
				(stop, i) =>
					stop.kind === "season" && (
						<SeasonTitle key={stop.season} x={i * SPACING} stop={stop} />
					),
			)}
			<SpeedBlur speed={shared.uSpeed} camX={shared.uCamX} />
			<Foreground palette={palette} length={length} />
			<Particles palette={palette} shared={shared} />
		</>
	);
}

/** Uniform objects shared by every material; Line updates them once per frame. */
function createShared(palette: Palette) {
	return {
		uTime: { value: 0 },
		uCamX: { value: 0 },
		/** The train's position as a fractional stop index. */
		uProgress: { value: 0 },
		/** Aerial haze: the sky's bottom tinted toward its top, the same for every material and the scene fog. */
		uHaze: { value: new Color() },
		uFogDensity: { value: FOG_DENSITY },
		uAspect: { value: 1 },
		/** How fast the train runs, 0 (standing at a stop) to 1. */
		uSpeed: { value: 0 },
		uFallSpeed: { value: palette.fallSpeed },
		uSway: { value: palette.sway },
		uSize: { value: palette.size },
		uOpacity: { value: palette.opacity },
	};
}
type Shared = ReturnType<typeof createShared>;

/**
 * Built by hand rather than as <shaderMaterial uniforms={…}>: R3F copies JSX uniforms,
 * which would freeze the numbers Line updates every frame.
 */
function useShader(parameters: ShaderMaterialParameters) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: built once; uniforms are mutated in place
	return useMemo(() => new ShaderMaterial(parameters), []);
}

const isStation = (stop: Stop): stop is Extract<Stop, { kind: "station" }> =>
	stop.kind === "station";

function Sky({ palette, shared }: { palette: Palette; shared: Shared }) {
	const material = useShader({
		vertexShader: glsl.skyVertex,
		fragmentShader: glsl.skyFragment,
		uniforms: {
			uTop: { value: palette.skyTop },
			uBottom: { value: palette.skyBottom },
			uSun: { value: palette.sun },
			uCloud: { value: palette.cloud },
			uTime: shared.uTime,
			uOffset: shared.uCamX,
			uAspect: shared.uAspect,
		},
		depthWrite: false,
		depthTest: false,
	});
	return (
		<mesh frustumCulled={false} renderOrder={-1} material={material}>
			<planeGeometry args={[2, 2]} />
		</mesh>
	);
}

/** A card spanning the whole line at depth z, from below the window up to `top`. */
function cardGeometry(z: number, top: number, length: number) {
	const half = halfHeightAt(z);
	const bottom = CAMERA.y - half - 2;
	const width = length + half * 6;
	return {
		args: [width, top - bottom] as [number, number],
		position: [length / 2, (top + bottom) / 2, z] as [number, number, number],
	};
}

/** Sunlight, sky light and distance fog, all bound to the season palette. */
function Atmosphere({ palette, shared }: { palette: Palette; shared: Shared }) {
	const scene = useThree((state) => state.scene);
	const [sky, sun] = useMemo(() => {
		const sky = new HemisphereLight();
		sky.color = palette.skyTop;
		sky.groundColor = palette.ground;
		sky.intensity = 1;
		const sun = new DirectionalLight();
		sun.color = palette.sun;
		sun.intensity = 2.6;
		sun.position.copy(SUN_DIRECTION).multiplyScalar(100);
		return [sky, sun];
	}, [palette]);

	useEffect(() => {
		const fog = new FogExp2(0, FOG_DENSITY);
		fog.color = shared.uHaze.value;
		scene.fog = fog;
		return () => {
			scene.fog = null;
		};
	}, [scene, shared]);

	return (
		<>
			<primitive object={sky} />
			<primitive object={sun} />
		</>
	);
}

/** CC0 Poly Haven textures (see public/textures/2026/LICENSE.md), repeated across the whole terrain. */
function terrainTexture(name: string, color: boolean) {
	const texture = new TextureLoader().load(`/textures/2026/${name}.webp`);
	texture.wrapS = texture.wrapT = RepeatWrapping;
	texture.anisotropy = 8;
	if (color) texture.colorSpace = SRGBColorSpace;
	return texture;
}

function Terrain({
	stops,
	length,
	palette,
	shared,
}: {
	stops: Stop[];
	length: number;
	palette: Palette;
	shared: Shared;
}) {
	const geometry = useMemo(() => buildTerrain(stops, length), [stops, length]);
	const material = useShader({
		vertexShader: glsl.terrainVertex,
		fragmentShader: glsl.terrainFragment,
		uniforms: {
			uRock: { value: terrainTexture("rock_face_03_color", true) },
			uRockNormal: { value: terrainTexture("rock_face_03_normal", false) },
			uGrass: { value: terrainTexture("aerial_grass_rock_color", true) },
			uGrassNormal: {
				value: terrainTexture("aerial_grass_rock_normal", false),
			},
			uSnow: { value: terrainTexture("snow_02_color", true) },
			uSnowNormal: { value: terrainTexture("snow_02_normal", false) },
			uSun: { value: palette.sun },
			uSunDir: { value: SUN_DIRECTION },
			uSky: { value: palette.skyTop },
			uGround: { value: palette.ground },
			uFog: shared.uHaze,
			uFogDensity: shared.uFogDensity,
		},
	});
	return <mesh geometry={geometry} material={material} />;
}

/** Ballast from the platform edge right up under the window, so a tall phone view never runs out of ground. */
const GRAVEL = { center: 3.4, width: 14.4 };

/** The neighbouring track between the train and the platform: two rails on wooden sleepers. */
const TRACK = { z: -1.5, gauge: 1.1, sleeperGap: 0.9 };

function Track({ length }: { length: number }) {
	const sleepers = useMemo(() => {
		const from = -80;
		const count = Math.ceil((length + 160) / TRACK.sleeperGap);
		const mesh = new InstancedMesh(
			undefined,
			new MeshStandardMaterial({ color: "#5a463a", roughness: 0.9 }),
			count,
		);
		const matrix = new Matrix4();
		for (let i = 0; i < count; i++) {
			mesh.setMatrixAt(
				i,
				matrix.makeTranslation(
					from + i * TRACK.sleeperGap,
					GROUND_Y + 0.05,
					TRACK.z,
				),
			);
		}
		return mesh;
	}, [length]);

	const gravel = useMemo(() => {
		const texture = gravelTexture().clone();
		texture.repeat.set((length + 160) / 3, GRAVEL.width / 3);
		return new MeshStandardMaterial({ map: texture, roughness: 1 });
	}, [length]);

	return (
		<group>
			<mesh
				position={[length / 2, GROUND_Y + 0.01, GRAVEL.center]}
				rotation-x={-Math.PI / 2}
				material={gravel}
			>
				<planeGeometry args={[length + 160, GRAVEL.width]} />
			</mesh>
			<primitive object={sleepers} frustumCulled={false}>
				<boxGeometry attach="geometry" args={[0.26, 0.1, 2.3]} />
			</primitive>
			{[-1, 1].map((side) => (
				<mesh
					key={side}
					position={[
						length / 2,
						GROUND_Y + 0.17,
						TRACK.z + (side * TRACK.gauge) / 2,
					]}
				>
					<boxGeometry args={[length + 160, 0.09, 0.07]} />
					<meshStandardMaterial
						color="#9aa0ad"
						metalness={0.6}
						roughness={0.4}
					/>
				</mesh>
			))}
		</group>
	);
}

/** The river as a ribbon of water following its bed, a little wider than the channel so the banks meet it. */
function River({
	palette,
	shared,
	length,
}: {
	palette: Palette;
	shared: Shared;
	length: number;
}) {
	const geometry = useMemo(() => {
		const from = -260;
		const steps = Math.ceil((length + 520) / 2);
		const positions = new Float32Array((steps + 1) * 2 * 3);
		const index: number[] = [];
		for (let i = 0; i <= steps; i++) {
			const x = from + i * 2;
			const { center, halfWidth } = riverAt(x);
			positions.set(
				[x, WATER_Y, TRACK_EDGE_Z - center + halfWidth * 0.9],
				i * 6,
			);
			positions.set(
				[x, WATER_Y, TRACK_EDGE_Z - center - halfWidth * 0.9],
				i * 6 + 3,
			);
			if (i < steps) {
				const v = i * 2;
				index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
			}
		}
		const ribbon = new BufferGeometry();
		ribbon.setAttribute("position", new BufferAttribute(positions, 3));
		ribbon.setIndex(index);
		return ribbon;
	}, [length]);
	const material = useShader({
		vertexShader: glsl.worldVertex,
		fragmentShader: glsl.waterFragment,
		uniforms: {
			uTop: { value: palette.skyTop },
			uBottom: { value: palette.skyBottom },
			uSun: { value: palette.sun },
			uTime: shared.uTime,
			uCamX: shared.uCamX,
			uFog: shared.uHaze,
			uFogDensity: shared.uFogDensity,
		},
	});
	return <mesh geometry={geometry} material={material} />;
}

const KANJI = { winter: "冬", spring: "春", summer: "夏", fall: "秋" } as const;
const seasonFont = (size: number) =>
	`800 ${size}px "Shippori Mincho B1", serif`;
// On the far bank, just in front of its curtain of trees: only bushes and the odd treetop overlap it.
// Same apparent size and place as at depth 78 / height 38, scaled down with the distance.
const SEASON_TITLE = { depth: 24, height: 16.6 };

/** The season written into the landscape: a tall kanji over its name, standing in the valley. */
function SeasonTitle({
	x,
	stop,
}: {
	x: number;
	stop: Extract<Stop, { kind: "season" }>;
}) {
	const [texture, setTexture] = useState<CanvasTexture>();
	useEffect(() => {
		let cancelled = false;
		const display = seasonFont;
		// The canvas only uses the web font once it has loaded; fall back to serif if it never does.
		document.fonts
			.load(display(320), KANJI[stop.season] + stop.label)
			.catch(() => undefined)
			.then(() => {
				if (cancelled) return;
				const canvas = document.createElement("canvas");
				canvas.width = 1024;
				canvas.height = 1024;
				const g = canvas.getContext("2d") as CanvasRenderingContext2D;
				g.textAlign = "center";
				g.textBaseline = "alphabetic";
				g.fillStyle = "#fffaf0";
				g.font = display(560);
				g.fillText(KANJI[stop.season], 512, 690);
				// Shrink long names (PRINTEMPS, AUTOMNE…) until they fit the canvas instead of being cut off.
				const label = stop.label.toUpperCase();
				g.letterSpacing = "18px";
				for (let size = 150; size >= 60; size -= 6) {
					g.font = display(size);
					if (g.measureText(label).width <= 960) break;
				}
				g.fillText(label, 512, 900);
				setTexture(srgb(new CanvasTexture(canvas)));
			});
		return () => {
			cancelled = true;
		};
	}, [stop]);

	if (!texture) return null;
	const z = TRACK_EDGE_Z - SEASON_TITLE.depth;
	const ground = heightAt(x, z);
	const size = SEASON_TITLE.height;
	return (
		<mesh position={[x, ground + size / 2 + 3, z]}>
			<planeGeometry args={[size, size]} />
			<meshBasicMaterial
				map={texture}
				transparent
				opacity={0.92}
				depthWrite={false}
			/>
		</mesh>
	);
}

function Foreground({ palette, length }: { palette: Palette; length: number }) {
	const material = useShader({
		vertexShader: glsl.worldVertex,
		fragmentShader: glsl.foreFragment,
		transparent: true,
		// An odd fraction of the stop spacing, offset by half: no pole ever stands in front of a resting station.
		uniforms: {
			uColor: { value: palette.fore },
			uSpacing: { value: SPACING / 17 },
		},
	});
	const card = cardGeometry(4, 5.2, length);
	return (
		<mesh position={card.position} renderOrder={1} material={material}>
			<planeGeometry args={card.args} />
		</mesh>
	);
}

type StationStop = Extract<Stop, { kind: "station" }>;

function Station({
	x,
	stop,
	previous,
	next,
	palette,
}: {
	x: number;
	stop: StationStop;
	previous?: StationStop;
	next?: StationStop;
	palette: Palette;
}) {
	const sign = useMemo(
		() => signTexture(stop, previous, next),
		[stop, previous, next],
	);
	// The palette Colors themselves (not copies), so the station follows the season.
	const [concrete, steel, deck] = useMemo(() => {
		const deck = paletteMaterial(palette.concrete);
		deck.map = platformTexture();
		return [
			paletteMaterial(palette.concrete),
			paletteMaterial(palette.near),
			deck,
		];
	}, [palette]);
	const [roof, fence] = useMemo(
		() => [
			new MeshStandardMaterial({ color: "#3d4352", roughness: 0.7 }),
			new MeshStandardMaterial({ color: "#ece8e0", roughness: 0.8 }),
		],
		[],
	);

	return (
		<group position={[x, 0, -5]}>
			{/* Concrete platform: tiled deck with the white edge line and yellow tactile strip. */}
			<mesh position={[0, -1.2, 0]} material={concrete}>
				<boxGeometry args={[22, 0.8, 2.4]} />
			</mesh>
			<mesh position={[0, -0.795, 0]} rotation-x={-Math.PI / 2} material={deck}>
				<planeGeometry args={[22, 2.4]} />
			</mesh>

			{/* Little wooden station house with a lit window. */}
			{/* On the right: the anime's card covers the bottom-left corner of the window. */}
			<group position={[8.6, -0.8, -0.35]}>
				<mesh position={[0, 1.15, 0]}>
					<boxGeometry args={[4, 2.3, 1.6]} />
					<meshStandardMaterial color="#9b6a48" roughness={0.9} />
				</mesh>
				<mesh position={[0, 0.25, 0.81]}>
					<planeGeometry args={[4, 0.5]} />
					<meshStandardMaterial color="#6f4a33" roughness={0.9} />
				</mesh>
				{[-1, 1].map((side) => (
					<mesh
						key={side}
						position={[0, 2.55, side * 0.5]}
						rotation-x={side * -0.55}
						material={roof}
					>
						<boxGeometry args={[4.6, 0.1, 1.35]} />
					</mesh>
				))}
				<mesh position={[-0.8, 1.35, 0.81]}>
					<planeGeometry args={[1.3, 0.8]} />
					<meshBasicMaterial color="#ffd99c" />
				</mesh>
				<Glow size={2.6} color="#ffcf8a" opacity={0.25} />
				{[-1.45, -0.8, -0.15].map((barX) => (
					<mesh key={barX} position={[barX, 1.35, 0.82]}>
						<boxGeometry args={[0.05, 0.84, 0.02]} />
						<meshBasicMaterial color="#5a3b28" />
					</mesh>
				))}
				<mesh position={[1.05, 0.9, 0.81]}>
					<planeGeometry args={[0.85, 1.75]} />
					<meshStandardMaterial color="#4c3426" roughness={0.9} />
				</mesh>
			</group>

			{/* White fence along the back of the platform. */}
			<group position={[0, -0.8, -1.1]}>
				{Array.from({ length: 12 }, (_, i) => -10.6 + i * 1.5).map((postX) => (
					<mesh key={postX} position={[postX, 0.45, 0]} material={fence}>
						<boxGeometry args={[0.07, 0.9, 0.07]} />
					</mesh>
				))}
				{[0.35, 0.75].map((railY) => (
					<mesh key={railY} position={[-2.35, railY, 0]} material={fence}>
						<boxGeometry args={[16.6, 0.06, 0.04]} />
					</mesh>
				))}
			</group>

			{/* Station clock hanging from the canopy. */}
			<group position={[2.75, 1.9, 0.3]}>
				<mesh position={[0, 0.3, 0]} material={steel}>
					<boxGeometry args={[0.04, 0.35, 0.04]} />
				</mesh>
				<mesh>
					<circleGeometry args={[0.26, 32]} />
					<meshBasicMaterial map={clockTexture()} />
				</mesh>
			</group>

			{/* Canopy on three pillars, with a lamp under each bay. */}
			<mesh position={[0, 2.35, -0.2]} material={steel}>
				<boxGeometry args={[12, 0.14, 2.2]} />
			</mesh>
			{[-5.5, 0, 5.5].map((pillarX) => (
				<mesh key={pillarX} position={[pillarX, 0.8, -0.8]} material={steel}>
					<boxGeometry args={[0.14, 3.2, 0.14]} />
				</mesh>
			))}
			{[-2.75, 2.75].map((lampX) => (
				<group key={lampX} position={[lampX, 2.18, 0]}>
					<mesh>
						<boxGeometry args={[1.2, 0.06, 0.12]} />
						<meshBasicMaterial color="#fff6e0" />
					</mesh>
					<Glow size={3.2} color="#ffe2b0" opacity={0.35} />
				</group>
			))}

			{/* Station name board. */}
			<group position={[-3.3, 0.55, 0]}>
				{[-1.9, 1.9].map((postX) => (
					<mesh key={postX} position={[postX, -0.55, -0.05]} material={steel}>
						<boxGeometry args={[0.08, 1.7, 0.08]} />
					</mesh>
				))}
				<mesh>
					<planeGeometry args={[4.4, 1.55]} />
					<meshBasicMaterial map={sign} />
				</mesh>
			</group>

			{/* Bench under the canopy. */}
			<group position={[-0.4, -0.55, -0.3]}>
				<mesh material={steel}>
					<boxGeometry args={[1.8, 0.08, 0.45]} />
				</mesh>
				<mesh position={[0, 0.3, -0.2]} material={steel}>
					<boxGeometry args={[1.8, 0.4, 0.05]} />
				</mesh>
			</group>

			{/* A glowing vending machine: no Japanese platform is without one. */}
			<group position={[4.6, -0.05, -0.3]}>
				<Glow size={3.6} color="#cfe8ff" opacity={0.3} />
				<mesh>
					<boxGeometry args={[0.95, 1.9, 0.7]} />
					<meshBasicMaterial color="#c8323c" />
				</mesh>
				<mesh position={[0, 0.18, 0.36]}>
					<planeGeometry args={[0.8, 1.35]} />
					<meshBasicMaterial map={vendingTexture()} />
				</mesh>
			</group>
		</group>
	);
}

function paletteMaterial(color: Color) {
	const material = new MeshStandardMaterial({ roughness: 0.85 });
	material.color = color;
	return material;
}

/** Soft additive halo: lamps, lightboxes and the vending machine bleed light into the dusk. */
function Glow({
	size,
	color,
	opacity,
}: {
	size: number;
	color: string;
	opacity: number;
}) {
	return (
		<mesh position={[0, 0, -0.02]}>
			<planeGeometry args={[size, size]} />
			<meshBasicMaterial
				map={glowTexture()}
				color={color}
				opacity={opacity}
				transparent
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</mesh>
	);
}

/** Canvas drawings are authored in sRGB, like every hex color of the palette. */
function srgb(texture: CanvasTexture) {
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** Lazily drawn once and shared: a canvas is cheap, a texture per station is not. */
function once<T>(make: () => T) {
	let value: T | undefined;
	return () => {
		value ??= make();
		return value;
	};
}

const glowTexture = once(() => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 128;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	gradient.addColorStop(0, "rgba(255,255,255,1)");
	gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
	gradient.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = gradient;
	g.fillRect(0, 0, 128, 128);
	return srgb(new CanvasTexture(canvas));
});

/** 4 m of platform deck, front edge at the bottom: tiles, speckles, white line, tactile strip. */
const platformTexture = once(() => {
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 308;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	const rand = random(4);
	g.fillStyle = "#ece9e3";
	g.fillRect(0, 0, 512, 308);
	for (let i = 0; i < 2600; i++) {
		g.fillStyle = `rgba(80, 76, 70, ${rand() * 0.12})`;
		g.fillRect(rand() * 512, rand() * 250, 2, 2);
	}
	g.strokeStyle = "rgba(90, 86, 80, 0.35)";
	g.lineWidth = 2;
	for (let x = 0; x <= 512; x += 128) g.strokeRect(x, 0, 128, 64);
	for (let x = -64; x <= 512; x += 128) g.strokeRect(x, 64, 128, 64);
	for (let x = 0; x <= 512; x += 128) g.strokeRect(x, 128, 128, 64);
	g.fillStyle = "#e5c13f";
	g.fillRect(0, 216, 512, 40);
	g.fillStyle = "#c9a52c";
	for (let x = 6; x < 512; x += 13)
		for (let y = 222; y < 252; y += 10) g.fillRect(x, y, 5, 5);
	g.fillStyle = "#fbfaf7";
	g.fillRect(0, 268, 512, 16);
	g.fillStyle = "#8c877f";
	g.fillRect(0, 290, 512, 18);
	const texture = srgb(new CanvasTexture(canvas));
	texture.wrapS = RepeatWrapping;
	texture.repeat.set(22 / 4, 1);
	texture.anisotropy = 8;
	return texture;
});

/** Ballast: a scatter of grey stones, tiled under the track. */
export const gravelTexture = once(() => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 256;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	const rand = random(9);
	g.fillStyle = "#7a746d";
	g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 900; i++) {
		const shade = 90 + Math.floor(rand() * 90);
		g.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`;
		g.beginPath();
		g.ellipse(
			rand() * 256,
			rand() * 256,
			2 + rand() * 4,
			1.5 + rand() * 3,
			rand() * 3,
			0,
			Math.PI * 2,
		);
		g.fill();
	}
	const texture = srgb(new CanvasTexture(canvas));
	texture.wrapS = texture.wrapT = RepeatWrapping;
	return texture;
});

const clockTexture = once(() => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 128;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	g.fillStyle = "#fbfaf6";
	g.beginPath();
	g.arc(64, 64, 62, 0, Math.PI * 2);
	g.fill();
	g.lineWidth = 6;
	g.strokeStyle = "#2b2f3a";
	g.stroke();
	g.lineCap = "round";
	for (let h = 0; h < 12; h++) {
		const a = (h / 12) * Math.PI * 2;
		g.lineWidth = h % 3 ? 2 : 4;
		g.beginPath();
		g.moveTo(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48);
		g.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56);
		g.stroke();
	}
	// Ten past ten, the classic clock-face pose.
	for (const [angle, length, width] of [
		[-Math.PI / 3, 30, 5],
		[Math.PI / 3, 44, 3],
	] as const) {
		g.lineWidth = width;
		g.beginPath();
		g.moveTo(64, 64);
		g.lineTo(64 + Math.sin(angle) * length, 64 - Math.cos(angle) * length);
		g.stroke();
	}
	return srgb(new CanvasTexture(canvas));
});

const vendingTexture = once(() => {
	const canvas = document.createElement("canvas");
	canvas.width = 160;
	canvas.height = 270;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	g.fillStyle = "#f4fbff";
	g.fillRect(0, 0, 160, 270);
	const cans = [
		"#e2483d",
		"#3b7dd8",
		"#f2b632",
		"#4cae6a",
		"#f07aa8",
		"#7a5cc9",
	];
	for (let row = 0; row < 4; row++) {
		for (let col = 0; col < 6; col++) {
			g.fillStyle = cans[(row * 2 + col) % cans.length] as string;
			g.fillRect(10 + col * 24, 14 + row * 62, 16, 38);
			g.fillStyle = "#1d2230";
			g.fillRect(10 + col * 24, 56 + row * 62, 16, 5);
		}
	}
	return srgb(new CanvasTexture(canvas));
});

/** A Japanese station name board (駅名標): big title, romaji, and the line band with neighbours. */
function signTexture(
	stop: StationStop,
	previous?: StationStop,
	next?: StationStop,
) {
	const canvas = document.createElement("canvas");
	canvas.width = 1024;
	canvas.height = 360;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	const fonts = "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif";
	const fitFont = (text: string, max: number, size: number, weight: number) => {
		let px = size;
		do g.font = `${weight} ${px--}px ${fonts}`;
		while (g.measureText(text).width > max && px > 12);
	};

	g.fillStyle = "#fbfaf6";
	g.beginPath();
	g.roundRect(0, 0, 1024, 360, 28);
	g.fill();

	g.fillStyle = "#1d1d26";
	g.textAlign = "center";
	g.textBaseline = "middle";
	// Some "Japanese" titles are just the romaji in caps: show one line then.
	const japanese =
		stop.titleJapanese?.toLowerCase() === stop.title.toLowerCase()
			? null
			: stop.titleJapanese;
	fitFont(japanese ?? stop.title, 940, 104, 700);
	g.fillText(japanese ?? stop.title, 512, japanese ? 112 : 150);
	if (japanese) {
		fitFont(stop.title, 900, 50, 500);
		g.fillText(stop.title, 512, 208);
	}

	g.fillStyle = ACCENT;
	g.fillRect(0, 262, 1024, 58);
	g.fillStyle = "#1d1d26";
	g.font = `700 34px ${fonts}`;
	g.textAlign = "left";
	if (previous) g.fillText(`◀ ${truncate(previous.title)}`, 28, 292);
	g.textAlign = "right";
	if (next) g.fillText(`${truncate(next.title)} ▶`, 996, 292);

	const texture = srgb(new CanvasTexture(canvas));
	texture.anisotropy = 4;
	return texture;
}

const truncate = (text: string) =>
	text.length > 24 ? `${text.slice(0, 23)}…` : text;

const PARTICLES = 600;

function Particles({ palette, shared }: { palette: Palette; shared: Shared }) {
	const { positions, seeds } = useMemo(() => {
		const positions = new Float32Array(PARTICLES * 3);
		const seeds = new Float32Array(PARTICLES * 3);
		for (let i = 0; i < PARTICLES; i++) {
			positions.set(
				[Math.random() * 60, Math.random() * 22, -14 + Math.random() * 21],
				i * 3,
			);
			seeds.set([Math.random(), Math.random(), Math.random()], i * 3);
		}
		return { positions, seeds };
	}, []);
	const material = useShader({
		vertexShader: glsl.particleVertex,
		fragmentShader: glsl.particleFragment,
		transparent: true,
		depthWrite: false,
		uniforms: { ...shared, uColor: { value: palette.particle } },
	});
	return (
		<points frustumCulled={false} renderOrder={2} material={material}>
			<bufferGeometry>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} />
				<bufferAttribute attach="attributes-aSeed" args={[seeds, 3]} />
			</bufferGeometry>
		</points>
	);
}
