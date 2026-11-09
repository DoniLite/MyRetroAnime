// biome-ignore-all lint/a11y/noStaticElementInteractions: three.js objects, not DOM; the page's HTML links give keyboard access.
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
	AdditiveBlending,
	BoxGeometry,
	type BufferGeometry,
	CanvasTexture,
	Color,
	ConeGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Float32BufferAttribute,
	InstancedBufferAttribute,
	InstancedMesh,
	Matrix4,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	Quaternion,
	ShaderMaterial,
	Shape,
	SRGBColorSpace,
	Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Season } from "../../lib/seasons";
import { cameraStage, grovePlacement, hallHeight, propSlots } from "./layout";
import { glowTexture, go, hover } from "./shared";

export interface HallItem {
	slug: string;
	title: string;
	image: string | null;
	score: number | null;
	airedTo: string | null;
}

/**
 * Every anime of a grove as a season prop carrying its poster, however many there are. Each kind of part is
 * one instanced mesh (body, glowing parts, posters, halos, pools of light, plinths), so a grove costs the
 * same handful of draw calls with 3 anime or 50; the posters share one atlas texture.
 */

interface Part {
	geometry: BufferGeometry;
	color: string;
	glow?: boolean;
}
interface Kit {
	parts: Part[];
	poster: { y: number; z: number; width: number };
	halo?: { y: number; size: number; color: string };
}

const STONE = "#8f9097";
const WOOD = "#7a5236";

const at = (
	geometry: BufferGeometry,
	x: number,
	y: number,
	z: number,
	turn = 0,
) => {
	if (turn) geometry.rotateY(turn);
	return geometry.translate(x, y, z);
};
const box = (
	w: number,
	h: number,
	d: number,
	x: number,
	y: number,
	z: number,
) => at(new BoxGeometry(w, h, d), x, y, z);

const emaShape = () => {
	// The pentagon of an ema plaque: a little house shape.
	const shape = new Shape();
	shape.moveTo(-1.1, 0);
	shape.lineTo(1.1, 0);
	shape.lineTo(1.1, 2.6);
	shape.lineTo(0, 3.2);
	shape.lineTo(-1.1, 2.6);
	shape.closePath();
	return shape;
};

/** Winter: stone tōrō lanterns. Spring: nobori banners. Summer: paper lanterns. Fall: ema on their rack. */
const KITS: Record<Season, () => Kit> = {
	winter: () => ({
		parts: [
			{ geometry: box(1.8, 0.4, 1.8, 0, 0.2, 0), color: STONE },
			{
				geometry: at(new CylinderGeometry(0.32, 0.4, 1.4, 8), 0, 1.1, 0),
				color: STONE,
			},
			{ geometry: box(2.2, 2.9, 1.3, 0, 3.2, 0), color: STONE },
			{
				geometry: at(new ConeGeometry(2.1, 0.9, 4), 0, 5.05, 0, Math.PI / 4),
				color: STONE,
			},
			{
				geometry: at(new ConeGeometry(2.0, 0.7, 4), 0, 5.15, 0, Math.PI / 4),
				color: "#f2f5fa",
			},
		],
		poster: { y: 3.2, z: 0.66, width: 1.7 },
		halo: { y: 3.2, size: 6, color: "#ffd9a0" },
	}),
	spring: () => ({
		parts: [
			{
				geometry: at(new CylinderGeometry(0.06, 0.07, 6.8, 6), -1.05, 3.4, 0),
				color: WOOD,
			},
			{ geometry: box(2.2, 0.08, 0.08, 0, 6.55, 0), color: WOOD },
			{ geometry: box(2, 4.4, 0.03, 0, 4.35, -0.03), color: "#f3c4d3" },
		],
		poster: { y: 5, z: 0.01, width: 1.7 },
	}),
	summer: () => ({
		parts: [
			{ geometry: box(0.14, 5.8, 0.14, -1.4, 2.9, 0), color: WOOD },
			{ geometry: box(0.14, 5.8, 0.14, 1.4, 2.9, 0), color: WOOD },
			{ geometry: box(3.2, 0.16, 0.18, 0, 5.8, 0), color: WOOD },
			{ geometry: box(2.2, 3, 1.2, 0, 3.6, 0), color: "#ffcf8f", glow: true },
		],
		poster: { y: 3.6, z: 0.61, width: 1.75 },
		halo: { y: 3.6, size: 7, color: "#ffb070" },
	}),
	fall: () => ({
		parts: [
			{ geometry: box(0.14, 4.4, 0.14, -1.5, 2.2, -0.2), color: WOOD },
			{ geometry: box(0.14, 4.4, 0.14, 1.5, 2.2, -0.2), color: WOOD },
			{ geometry: box(3.4, 0.14, 0.14, 0, 4.3, -0.2), color: WOOD },
			{
				geometry: at(
					new ExtrudeGeometry(emaShape(), { depth: 0.12, bevelEnabled: false }),
					0,
					0.9,
					0,
				),
				color: "#c28c56",
			},
			{
				geometry: at(new CylinderGeometry(0.02, 0.02, 0.5, 4), 0, 4.15, 0),
				color: "#c0392b",
				glow: true,
			},
		],
		poster: { y: 2.25, z: 0.13, width: 1.55 },
	}),
};

/** One geometry from many parts, each painted its colour through a vertex colour attribute. */
function merge(parts: Part[]) {
	if (!parts.length) return null;
	return mergeGeometries(
		parts.map(({ geometry, color }) => {
			const flat = geometry.index ? geometry.toNonIndexed() : geometry;
			const { r, g, b } = new Color(color);
			const count = flat.attributes.position?.count ?? 0;
			const colors = new Float32Array(count * 3);
			for (let i = 0; i < count; i++) colors.set([r, g, b], i * 3);
			flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
			return flat;
		}),
	);
}

/** MAL serves a medium poster at the same URL without the trailing "l": plenty for an atlas cell. */
const medium = (url: string) => url.replace(/l\.(jpg|webp)$/, ".$1");

/** A poster atlas sized to the grove: cells keep the 1:1.41 poster ratio, a placeholder until each loads. */
function posterAtlas(count: number) {
	const size = count <= 12 ? 1024 : 2048;
	let cols = Math.max(1, Math.ceil(Math.sqrt(1.41 * count)));
	let cw = 0;
	let ch = 0;
	for (;;) {
		cw = Math.floor(size / cols);
		ch = Math.floor(cw * 1.41);
		if (cols * Math.floor(size / ch) >= count) break;
		cols++;
	}
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	g.fillStyle = "#3b3f52";
	g.fillRect(0, 0, size, size);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 4;
	const cell = (i: number) => ({
		x: (i % cols) * cw,
		y: Math.floor(i / cols) * ch,
	});
	// Texture coordinates of a cell (the canvas is flipped on upload: v grows upward).
	const uv = (i: number) => {
		const { x, y } = cell(i);
		return [x / size, 1 - (y + ch) / size, cw / size, ch / size] as const;
	};
	const draw = (i: number, image: HTMLImageElement) => {
		const { x, y } = cell(i);
		// Cover the cell, cropping the image's excess, inside a 2 px margin against mip bleeding.
		const ratio = Math.min(image.width / (cw - 4), image.height / (ch - 4));
		const sw = (cw - 4) * ratio;
		const sh = (ch - 4) * ratio;
		g.drawImage(
			image,
			(image.width - sw) / 2,
			(image.height - sh) / 2,
			sw,
			sh,
			x + 2,
			y + 2,
			cw - 4,
			ch - 4,
		);
		texture.needsUpdate = true;
	};
	return { texture, uv, draw };
}

const posterMaterial = (atlas: CanvasTexture) =>
	new ShaderMaterial({
		uniforms: { uAtlas: { value: atlas } },
		vertexShader: /* glsl */ `
			attribute vec4 aCell;
			attribute float aHover;
			varying vec2 vUv;
			varying float vHover;
			void main() {
				vUv = aCell.xy + uv * aCell.zw;
				vHover = aHover;
				gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
			}
		`,
		// Unlit so posters read at dusk; a hovered poster brightens a little.
		fragmentShader: /* glsl */ `
			uniform sampler2D uAtlas;
			varying vec2 vUv;
			varying float vHover;
			void main() {
				gl_FragColor = vec4(texture2D(uAtlas, vUv).rgb * (1.0 + 0.3 * vHover), 1.0);
				#include <colorspace_fragment>
			}
		`,
	});

const HALO = 0.45;
const POOL = 0.22;
const up = new Vector3(0, 1, 0);
const m = new Matrix4();
const local = new Matrix4();

export function PropField({
	index,
	season,
	items,
	lineUrl,
	stage,
}: {
	index: number;
	season: Season;
	items: HallItem[];
	lineUrl: string;
	/** The scroll stage: posters load once the visitor heads for this grove's stop. */
	stage: () => number;
}) {
	const field = useMemo(() => {
		// Already in featured order (the page sorts them, for its panels too).
		const ordered = items;
		const slots = propSlots(index, ordered.length);
		const kit = KITS[season]();
		const count = ordered.length;
		const [cx, , cz] = cameraStage(grovePlacement(index).stage).position;
		// Each prop's resting transform: on its plinth, turned to face the visitor's camera.
		const bases = slots.map(({ x, z, scale, lift }) => {
			const y = hallHeight(x, z);
			const turn = new Quaternion().setFromAxisAngle(
				up,
				Math.atan2(cx - x, cz - z),
			);
			return { x, y, z, scale, lift, turn };
		});
		const lit = merge(kit.parts.filter((p) => !p.glow));
		const glowing = merge(kit.parts.filter((p) => p.glow));
		const atlas = posterAtlas(count);
		const posterGeometry = new PlaneGeometry(1, 1.41);
		posterGeometry.setAttribute(
			"aCell",
			new InstancedBufferAttribute(
				new Float32Array(ordered.flatMap((_, i) => [...atlas.uv(i)])),
				4,
			),
		);
		const hoverAttribute = new InstancedBufferAttribute(
			new Float32Array(count),
			1,
		);
		posterGeometry.setAttribute("aHover", hoverAttribute);
		const glow = glowTexture();
		const meshes = {
			body:
				lit &&
				new InstancedMesh(
					lit,
					new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
					count,
				),
			glow:
				glowing &&
				new InstancedMesh(
					glowing,
					new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
					count,
				),
			poster: new InstancedMesh(
				posterGeometry,
				posterMaterial(atlas.texture),
				count,
			),
			halo:
				kit.halo &&
				new InstancedMesh(
					new PlaneGeometry(1, 1),
					new MeshBasicMaterial({
						map: glow,
						color: kit.halo.color,
						transparent: true,
						depthWrite: false,
						blending: AdditiveBlending,
					}),
					count,
				),
			pool: new InstancedMesh(
				new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
				new MeshBasicMaterial({
					map: glow,
					color: "#ffcf8f",
					transparent: true,
					depthWrite: false,
					blending: AdditiveBlending,
				}),
				count,
			),
			plinth: new InstancedMesh(
				new BoxGeometry(1, 1, 1),
				new MeshStandardMaterial({ color: STONE, roughness: 1 }),
				count,
			),
		};
		const grey = new Color();
		bases.forEach(({ x, y, z, scale, lift, turn }, i) => {
			const width = scale * 3.6;
			m.compose(
				new Vector3(x, y + lift / 2, z),
				turn,
				new Vector3(lift ? width : 0, lift || 1, lift ? scale * 2.6 : 0),
			);
			meshes.plinth.setMatrixAt(i, m);
			m.compose(
				new Vector3(x, y + 0.15, z),
				turn,
				new Vector3(6 * scale, 1, 6 * scale),
			);
			meshes.pool.setMatrixAt(i, m.multiply(local.makeTranslation(0, 0, 0.1)));
			meshes.pool.setColorAt(i, grey.setScalar(POOL));
			meshes.halo?.setColorAt(i, grey.setScalar(HALO));
		});
		const hovered = new Float32Array(count);
		/** Places prop i, lifted toward the visitor by its hover amount h (0 to 1). */
		const place = (i: number, h: number) => {
			const { x, y, z, scale, lift, turn } = bases[i] as (typeof bases)[number];
			m.compose(new Vector3(x, y + lift, z), turn, new Vector3(1, 1, 1))
				.multiply(local.makeTranslation(0, 0.3 * h, 0.45 * h))
				.multiply(local.makeScale(scale, scale, scale));
			meshes.body?.setMatrixAt(i, m);
			meshes.glow?.setMatrixAt(i, m);
			const base = m.clone();
			const { y: py, z: pz, width } = kit.poster;
			meshes.poster.setMatrixAt(
				i,
				base
					.clone()
					.multiply(local.makeTranslation(0, py, pz + 0.005))
					.multiply(local.makeScale(width, width, 1)),
			);
			if (kit.halo && meshes.halo) {
				meshes.halo.setMatrixAt(
					i,
					base
						.multiply(local.makeTranslation(0, kit.halo.y, -0.3))
						.multiply(local.makeScale(kit.halo.size, kit.halo.size, 1)),
				);
				meshes.halo.setColorAt(i, grey.setScalar(HALO + 0.35 * h));
			}
			meshes.pool.setColorAt(i, grey.setScalar(POOL + 0.2 * h));
			hoverAttribute.setX(i, h);
		};
		for (let i = 0; i < count; i++) place(i, 0);
		for (const mesh of Object.values(meshes)) {
			if (!mesh) continue;
			mesh.instanceMatrix.needsUpdate = true;
			if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
			mesh.computeBoundingSphere();
		}
		return { ordered, meshes, atlas, hovered, place, hoverAttribute };
	}, [index, season, items]);

	const target = useRef<number | null>(null);
	const loading = useRef(false);

	useEffect(
		() => () => {
			for (const mesh of Object.values(field.meshes)) {
				if (!mesh) continue;
				mesh.geometry.dispose();
				(mesh.material as MeshBasicMaterial).dispose();
				mesh.dispose();
			}
			field.atlas.texture.dispose();
		},
		[field],
	);

	useFrame((_, delta) => {
		const pair = Math.floor(index / 2);
		if (!loading.current && stage() > pair - 0.75) {
			loading.current = true;
			field.ordered.forEach((item, i) => {
				if (!item.image) return;
				// MAL's CDN sends Access-Control-Allow-Origin: *, so the atlas stays readable by WebGL.
				const image = new Image();
				image.crossOrigin = "anonymous";
				image.onload = () => field.atlas.draw(i, image);
				image.src = medium(item.image);
			});
		}
		// Ease each prop toward its hover state; only moving props are re-placed.
		let moved = false;
		const k = 1 - Math.exp(-delta * 10);
		field.hovered.forEach((h, i) => {
			const goal = target.current === i ? 1 : 0;
			if (Math.abs(goal - h) < 0.001) return;
			const next = Math.abs(goal - h) < 0.01 ? goal : h + (goal - h) * k;
			field.hovered[i] = next;
			field.place(i, next);
			moved = true;
		});
		if (!moved) return;
		field.hoverAttribute.needsUpdate = true;
		for (const mesh of Object.values(field.meshes)) {
			if (!mesh) continue;
			mesh.instanceMatrix.needsUpdate = true;
			if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		}
	});

	const point = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		const i = event.instanceId;
		if (i === undefined || i === target.current) return;
		target.current = i;
		document.body.style.cursor = "pointer";
		const item = field.ordered[i];
		if (item)
			hover({ label: item.title, image: item.image && medium(item.image) });
	};
	const leave = () => {
		target.current = null;
		document.body.style.cursor = "";
		hover(null);
	};
	const select = (event: ThreeEvent<MouseEvent>) => {
		event.stopPropagation();
		const item =
			event.instanceId === undefined
				? undefined
				: field.ordered[event.instanceId];
		if (item) go(`${lineUrl}${item.slug}/`);
	};
	const { body, glow, poster, halo, pool, plinth } = field.meshes;
	return (
		<>
			{[body, poster].map(
				(mesh) =>
					mesh && (
						<primitive
							key={mesh.uuid}
							object={mesh}
							onPointerMove={point}
							onPointerOut={leave}
							onClick={select}
						/>
					),
			)}
			{[glow, halo, pool, plinth].map(
				(mesh) => mesh && <primitive key={mesh.uuid} object={mesh} />,
			)}
		</>
	);
}
