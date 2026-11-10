import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import {
	Box3,
	Color,
	DirectionalLight,
	DoubleSide,
	HemisphereLight,
	InstancedMesh,
	LinearMipmapLinearFilter,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	type MeshStandardMaterial,
	OrthographicCamera,
	PlaneGeometry,
	Quaternion,
	Scene,
	Vector3,
	type WebGLRenderer,
	WebGLRenderTarget,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../years/2026/terrain";
import { barkMaterial, leafMaterial } from "../../years/2026/Vegetation";
import { gltfLoader } from "../loading";
import {
	cameraStage,
	hallHeight,
	SNOW_LINE,
	sando,
	sandoLength,
	TRAIN,
	valleyWidth,
} from "./layout";
import { random } from "./shared";

/**
 * The forest that clothes every slope of the valley, far from the camera. Thousands of detailed trees (8k
 * triangles each) would not hold on a phone, so the hall photographs the line's own pine once, with its
 * textures and under the hall's light, and plants that picture on two crossed cards: the far woods look
 * like the near ones at four triangles a tree.
 */

const PINE = "pine_1";
const PINE_TINT = "#4f6f4a";
/** The hall's lights, repeated in the photo booth so the picture is lit like the trees around it. */
const LIGHTS = () => {
	const sun = new DirectionalLight("#ffc9a0", 0.7);
	sun.position.set(-30, 25, -60);
	return [new HemisphereLight("#7f8fc4", "#20243a", 0.9), sun];
};

const loaded = (materials: MeshStandardMaterial[]) =>
	new Promise<void>((resolve) => {
		const wait = () =>
			materials.every(
				(m) => m.map?.image && (!m.normalMap || m.normalMap.image),
			)
				? resolve()
				: requestAnimationFrame(wait);
		wait();
	});

/** The pine seen from the front, on a transparent card, and the card's size in world units. */
function photograph(renderer: WebGLRenderer, parts: Mesh[]) {
	const booth = new Scene();
	booth.add(...LIGHTS(), ...parts);
	const box = new Box3().setFromObject(booth);
	const half = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
	const height = box.max.y - box.min.y;
	const camera = new OrthographicCamera(
		-half,
		half,
		box.max.y,
		box.min.y,
		0.1,
		200,
	);
	camera.position.set(0, 0, 100);
	const target = new WebGLRenderTarget(
		256,
		Math.round((256 * height) / (2 * half)),
	);
	target.texture.generateMipmaps = true;
	target.texture.minFilter = LinearMipmapLinearFilter;
	const previous = renderer.getRenderTarget();
	const clear = renderer.getClearColor(new Color());
	const alpha = renderer.getClearAlpha();
	// Cleared to the foliage's own dark green, so the softened edges of far cards never turn black.
	renderer.setClearColor(new Color(PINE_TINT).multiplyScalar(0.25), 0);
	renderer.setRenderTarget(target);
	renderer.clear();
	renderer.render(booth, camera);
	renderer.setRenderTarget(previous);
	renderer.setClearColor(clear, alpha);
	return {
		texture: target.texture,
		target,
		width: 2 * half,
		height,
		bottom: box.min.y,
	};
}

function crossedCards(width: number, height: number, bottom: number) {
	const card = new PlaneGeometry(width, height).translate(
		0,
		bottom + height / 2,
		0,
	);
	return mergeGeometries([card, card.clone().rotateY(Math.PI / 2)]);
}

/** Item counts of each season: their avenues stay open. */
export function Woods({ counts }: { counts: number[] }) {
	const renderer = useThree((state) => state.gl);
	const [mesh, setMesh] = useState<InstancedMesh>();
	const spots = useMemo(() => {
		const rand = random(31);
		const avenues = counts.map((n, i) => sando(i, sandoLength(n)));
		const cameras = [1, 2, 3].map((stage) => cameraStage(stage).position);
		const spots: Matrix4[] = [];
		const m = new Matrix4();
		const turn = new Quaternion();
		const up = new Vector3(0, 1, 0);
		for (let n = 0; n < 9000 && spots.length < 4000; n++) {
			const d = 30 + rand() * 500;
			const x = TRAIN.x + (rand() - 0.5) * 640;
			const z = -d;
			const lateral = Math.abs(x - TRAIN.x);
			const width = valleyWidth(d);
			if (lateral < Math.min(30, width * 0.9)) continue;
			const y = hallHeight(x, z);
			const slope =
				Math.hypot(
					hallHeight(x + 1, z) - hallHeight(x - 1, z),
					hallHeight(x, z + 1) - hallHeight(x, z - 1),
				) / 2;
			if (y > SNOW_LINE - 12 || slope > 1.4) continue;
			// Thick on the slopes, in clumps on the valley floor.
			const onSlope = lateral > width * 0.85;
			if (fbm(x * 0.018, z * 0.018, 3) < (onSlope ? 0.32 : 0.55)) continue;
			// The detailed trees own the near ground of every stop and the avenues.
			if (cameras.some(([cx, , cz]) => Math.hypot(x - cx, z - cz) < 70))
				continue;
			const nearAvenue = avenues.some(({ entrance, shrine }) => {
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
				return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < 16;
			});
			if (nearAvenue) continue;
			const size = 0.6 + rand() * 0.5;
			turn.setFromAxisAngle(up, rand() * Math.PI * 2);
			m.compose(
				new Vector3(x, y - 0.3, z),
				turn,
				new Vector3(size, size * (0.9 + rand() * 0.4), size),
			);
			spots.push(m.clone());
		}
		return spots;
	}, [counts]);

	useEffect(() => {
		let cancelled = false;
		let built: { mesh: InstancedMesh; dispose: () => void } | undefined;
		// load() rather than loadAsync(): the scene stays in its loading state until the pine is planted.
		gltfLoader().load("/models/2026/trees.glb", async (gltf) => {
			gltf.scene.updateMatrixWorld(true);
			const materials = [barkMaterial("pine"), leafMaterial("pine", PINE_TINT)];
			const parts = (["branches", "leaves"] as const).flatMap((part, i) => {
				const node = gltf.scene.getObjectByName(`${PINE}_${part}`);
				if (!(node instanceof Mesh)) return [];
				const mesh = new Mesh(node.geometry, materials[i]);
				mesh.applyMatrix4(node.matrixWorld);
				return [mesh];
			});
			await loaded(materials);
			if (cancelled) return;
			const photo = photograph(renderer, parts);
			const material = new MeshBasicMaterial({
				map: photo.texture,
				alphaTest: 0.45,
				side: DoubleSide,
			});
			const mesh = new InstancedMesh(
				crossedCards(photo.width, photo.height, photo.bottom),
				material,
				spots.length,
			);
			const shade = random(43);
			const tint = new Color();
			spots.forEach((spot, i) => {
				mesh.setMatrixAt(i, spot);
				mesh.setColorAt(i, tint.setScalar(0.8 + shade() * 0.25));
			});
			mesh.computeBoundingSphere();
			built = {
				mesh,
				dispose: () => {
					mesh.geometry.dispose();
					material.dispose();
					photo.target.dispose();
					mesh.dispose();
				},
			};
			setMesh(mesh);
		});
		return () => {
			cancelled = true;
			built?.dispose();
		};
	}, [renderer, spots]);
	return mesh ? <primitive object={mesh} /> : null;
}
