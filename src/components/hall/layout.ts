import { fbm, ridged, smoothstep } from "../../years/2026/terrain";

// shortcut: the hall borrows the 2026 terrain shader, textures, noise and tree models; move them to a shared
// module if a later year changes them.

/** Where things stand in the hall. The track runs along -z from the platform into the valley. */
export const TRAIN = { length: 21, x: 2.1, z: -16, railTop: 0.32 };
// The platform runs on beside the track into the valley, the same all the way: one walk from the station to the seasons.
export const PLATFORM = { top: 1.05, edge: 0.55, width: 7, length: 388 };
export const TRACK_END = -460;
export const SNOW_LINE = 105;
/** Where the gorge opens into the basin: the woods along the track give way to the seasons' clearing. */
export const CLEARING_START = 170;

/** Track distance between two pairs of groves: one scroll screen moves the visitor this far. */
export const PAIR_GAP = 90;
/** How far the train has run into the valley when the camera reaches the first pair of groves. */
export const TRAIN_RUN = 225;
/** The first stop stands just past the gorge's mouth: the dive ends on the basin opening up. */
const FIRST_STOP = 185;

/**
 * The camera at each scroll stop: stage 0 stands on the platform, stage k ≥ 1 hovers in front of the
 * k-th pair of groves, looking down the valley between them.
 */
export function cameraStage(stage: number) {
	if (stage <= 0) {
		return {
			position: [-1.2, PLATFORM.top + 1.6, 6],
			target: [1.5, 2.2, -60],
		} as const;
	}
	const k = stage - 1;
	return {
		position: [TRAIN.x, 9, -FIRST_STOP - k * PAIR_GAP],
		target: [TRAIN.x, 5, -FIRST_STOP - 80 - k * PAIR_GAP],
	} as const;
}

/** How far the train has run at a (fractional) stage: out of the station, then pair to pair. */
export function trainRun(stage: number) {
	return stage <= 1 ? stage * TRAIN_RUN : TRAIN_RUN + (stage - 1) * PAIR_GAP;
}

/**
 * Half-width of the valley floor along the line: the station's plateau, then a narrow gorge, then the
 * gorge opens into a wide basin ringed with mountains, which closes again far ahead.
 */
export function valleyWidth(d: number) {
	const plateau = 55;
	const gorge = 26;
	const basin = 130;
	return (
		plateau +
		(gorge - plateau) * smoothstep(70, 115, d) +
		(basin - gorge) * smoothstep(CLEARING_START - 20, CLEARING_START + 45, d) -
		(basin - 70) * smoothstep(440, 540, d)
	);
}

/**
 * The valley the line runs into. From the plateau the track enters a gorge between sheer wooded walls;
 * past its mouth the walls fall back into a basin whose floor bowls up gently into long forested slopes,
 * where the seasons' avenues climb. A low ridge closes it far ahead; the high ranges stand behind.
 */
export function hallHeight(x: number, z: number) {
	const d = Math.max(0, -z);
	const lateral = Math.abs(x - TRAIN.x);
	const width = valleyWidth(d);
	const basin = smoothstep(CLEARING_START - 20, CLEARING_START + 45, d);
	// Gorge walls climb steeply but stay wooded; the basin's slopes are long and high.
	const rise = smoothstep(width * 0.85, width * (3.2 - 0.9 * basin), lateral);
	const walls =
		rise *
		(40 + 30 * basin + (100 + 70 * basin) * ridged(x * 0.006 + 9, z * 0.006));
	const far =
		smoothstep(440, 560, d) * (22 + 55 * ridged(x * 0.004 + 4, z * 0.004));
	// The basin floor bowls up toward its slopes; the track bed stays level.
	const bowl = basin * 24 * smoothstep(14, width, lateral) ** 1.6;
	const floor =
		smoothstep(6, 30, lateral) * 2.5 * fbm(x * 0.03, z * 0.03, 3) + bowl;
	return floor + Math.max(walls, far);
}

/** Where each grove's sandō leaves the track: one pair per scroll stop, a screen apart. */
const SANDO = {
	/** Ahead of the stop's camera, where the torii and the level crossing stand. */
	ahead: 38,
	/** Torii distance from the track. */
	lateral: 12,
	/** The avenue's angle off the valley's axis: outward to the mountain side, mostly away. */
	angle: (40 * Math.PI) / 180,
};

/**
 * A grove: the stretch of its sandō where the featured anime stand. Its centre anchors the season's
 * particles, ground and title.
 */
export function grovePlacement(index: number) {
	const pair = Math.floor(index / 2);
	const side = index % 2 === 0 ? -1 : 1;
	const stage = pair + 1;
	const [, , cz] = cameraStage(stage).position;
	const x = TRAIN.x + side * (SANDO.lateral + Math.sin(SANDO.angle) * 24);
	const z = cz - SANDO.ahead - Math.cos(SANDO.angle) * 24;
	return { x, z, y: hallHeight(x, z), side, stage };
}

/**
 * A grove's sandō: a long straight avenue from its torii by the track, outward and away into the mountain
 * side, seen in perspective like the platform's lamps. What lines it spreads over the view; the shrine is
 * far up at its end, and grows farther as the season gathers more anime. `at(t, offset)` is the point a
 * fraction t along, offset sideways (positive to the avenue's left).
 */
export function sando(index: number, length = 70) {
	const side = index % 2 === 0 ? -1 : 1;
	const [, , cz] = cameraStage(Math.floor(index / 2) + 1).position;
	const entrance = [TRAIN.x + side * SANDO.lateral, cz - SANDO.ahead] as const;
	const dx = side * Math.sin(SANDO.angle);
	const dz = -Math.cos(SANDO.angle);
	const at = (t: number, offset = 0) =>
		[
			entrance[0] + dx * t * length - dz * offset,
			entrance[1] + dz * t * length + dx * offset,
		] as [number, number];
	return {
		entrance,
		shrine: at(1),
		length,
		at,
		heading: (_t: number) => Math.atan2(dx, dz),
	};
}

/** Avenue spacing: featured props alternate sides every 4 m, votive ones every 2.1 m. */
const AVENUE = {
	start: 6,
	featured: 4,
	votive: 2.1,
	featuredOffset: 4.6,
	votiveOffset: 3.6,
};

/** How long a grove's sandō runs for its number of anime: always on past the view, longer with more. */
export function sandoLength(count: number) {
	const featured = Math.min(count, FEATURED);
	const votive = Math.max(0, count - FEATURED);
	return Math.max(
		70,
		AVENUE.start + featured * AVENUE.featured + 2 + votive * AVENUE.votive + 12,
	);
}

/** Train length centred on its position: the crossing lamps watch its two ends. */
export const TRAIN_HALF = TRAIN.length / 2;

/**
 * The level crossing of each pair of groves joins its two torii across the track, just behind the train
 * standing at that stop, so the way across is never blocked while the visitor looks.
 */
export function crossingZ(pair: number) {
	return sando(pair * 2).entrance[1];
}

/** How many anime keep a full-size prop along the sandō; the rest become smaller votive props. */
export const FEATURED = 10;
export const FEATURED_SCALE = 1.1;
export const VOTIVE_SCALE = 0.5;
/** Widest prop footprint at scale 1 (the fall ema rack), used for spacing. */
export const PROP_WIDTH = 3.4;

export interface PropSlot {
	x: number;
	z: number;
	scale: number;
	/** Height of the stone plinth a votive prop stands on (0 for featured ones). */
	lift: number;
}

/**
 * Where a grove's anime stand along its avenue, any number of them: the first FEATURED alternate sides near
 * the torii, the others carry on up the avenue as smaller votive props on low stone bases.
 */
export function propSlots(index: number, count: number): PropSlot[] {
	const path = sando(index, sandoLength(count));
	const slots: PropSlot[] = [];
	const featured = Math.min(count, FEATURED);
	for (let i = 0; i < count; i++) {
		const votive = i >= featured;
		const distance = votive
			? AVENUE.start +
				featured * AVENUE.featured +
				2 +
				(i - featured) * AVENUE.votive
			: AVENUE.start + i * AVENUE.featured;
		const offset = votive ? AVENUE.votiveOffset : AVENUE.featuredOffset;
		const [x, z] = path.at(distance / path.length, i % 2 ? offset : -offset);
		slots.push({
			x,
			z,
			scale: votive ? VOTIVE_SCALE : FEATURED_SCALE,
			lift: votive ? 0.3 : 0,
		});
	}
	return slots;
}
