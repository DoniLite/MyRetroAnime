import { useEffect, useMemo } from "react";
import {
	type BufferGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	Float32BufferAttribute,
	InstancedMesh,
	Matrix4,
	MeshStandardMaterial,
	Quaternion,
	Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../years/2026/terrain";
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
 * The forest that clothes every slope of the valley, far from the camera: thousands of simple pines (about
 * 60 triangles each, one draw call) where the detailed trees (8k triangles each) could only be counted in
 * hundreds. Seen through the haze they read as dense woods; the detailed trees stay near the visitor.
 */

function pineGeometry() {
	const parts: [BufferGeometry, string][] = [
		[new CylinderGeometry(0.22, 0.32, 2.4, 5).translate(0, 1.2, 0), "#3b2a20"],
		[new ConeGeometry(2.4, 4, 7).translate(0, 3.6, 0), "#2f4a34"],
		[new ConeGeometry(1.85, 3.4, 7).translate(0, 5.6, 0), "#35523a"],
		[new ConeGeometry(1.2, 2.8, 7).translate(0, 7.4, 0), "#3b5a40"],
	];
	return mergeGeometries(
		parts.map(([geometry, color]) => {
			const flat = geometry.toNonIndexed();
			const { r, g, b } = new Color(color);
			const count = flat.attributes.position?.count ?? 0;
			const colors = new Float32Array(count * 3);
			for (let i = 0; i < count; i++) colors.set([r, g, b], i * 3);
			flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
			return flat;
		}),
	);
}

/** Item counts of each season: their avenues stay open. */
export function Woods({ counts }: { counts: number[] }) {
	const mesh = useMemo(() => {
		const rand = random(31);
		const avenues = counts.map((n, i) => sando(i, sandoLength(n)));
		const cameras = [1, 2, 3].map((stage) => cameraStage(stage).position);
		const spots: Matrix4[] = [];
		const tints: Color[] = [];
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
			const size = 0.9 + rand() * 0.8;
			turn.setFromAxisAngle(up, rand() * Math.PI * 2);
			m.compose(
				new Vector3(x, y - 0.3, z),
				turn,
				new Vector3(size, size * (0.9 + rand() * 0.4), size),
			);
			spots.push(m.clone());
			tints.push(
				new Color().setHSL(0.36 + rand() * 0.05, 0.25, 0.55 + rand() * 0.3),
			);
		}
		const mesh = new InstancedMesh(
			pineGeometry(),
			new MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
			spots.length,
		);
		spots.forEach((spot, i) => {
			mesh.setMatrixAt(i, spot);
			mesh.setColorAt(i, tints[i] as Color);
		});
		mesh.computeBoundingSphere();
		return mesh;
	}, [counts]);
	useEffect(
		() => () => {
			mesh.geometry.dispose();
			(mesh.material as MeshStandardMaterial).dispose();
			mesh.dispose();
		},
		[mesh],
	);
	return <primitive object={mesh} />;
}
