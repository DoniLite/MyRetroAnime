import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
	AdditiveBlending,
	CanvasTexture,
	type Group,
	type MeshBasicMaterial,
	RepeatWrapping,
	SRGBColorSpace,
} from "three";
import { hallHeight, TRAIN, TRAIN_HALF } from "./layout";
import { glowTexture } from "./shared";

// From the rails to the torii of the sandō on each side (sando() entrances stand 11 m off the track).
const ROAD = { width: 3.6, reach: 9.4 };
const RED_ON = "#ff3b2f";
const RED_OFF = "#3a1614";

let stripes: CanvasTexture | undefined;
/** Yellow and black diagonal bands, as on every Japanese crossing. */
function stripeTexture() {
	if (stripes) return stripes;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 64;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	g.fillStyle = "#f2c230";
	g.fillRect(0, 0, 64, 64);
	g.fillStyle = "#141414";
	for (let i = -64; i < 128; i += 32) {
		g.beginPath();
		g.moveTo(i, 0);
		g.lineTo(i + 16, 0);
		g.lineTo(i + 16 + 64, 64);
		g.lineTo(i + 64, 64);
		g.fill();
	}
	stripes = new CanvasTexture(canvas);
	stripes.wrapS = stripes.wrapT = RepeatWrapping;
	stripes.colorSpace = SRGBColorSpace;
	return stripes;
}

/**
 * A fumikiri where the visitor's way crosses the track between two groves: a gravel way from torii to torii with timber boards over
 * the rails, and on each side a post with its crossbuck, twin red lamps and a boom barrier. While the
 * train comes near and passes, the lamps alternate and the barriers come down.
 */
export function Crossing({ z, trainZ }: { z: number; trainZ: () => number }) {
	const sides = [-1, 1] as const;
	const lamps = useRef<MeshBasicMaterial[]>([]);
	const halos = useRef<MeshBasicMaterial[]>([]);
	const booms = useRef<Group[]>([]);
	const lowered = useRef(0);
	const glow = useMemo(glowTexture, []);
	const arm = useMemo(() => {
		const texture = stripeTexture().clone();
		texture.repeat.set(5, 1);
		texture.needsUpdate = true;
		return texture;
	}, []);

	useFrame(({ clock }, delta) => {
		// The train runs toward -z: ringing from when its front is 60 m away until its rear has cleared.
		const centre = trainZ();
		const ringing = centre - TRAIN_HALF < z + 60 && centre + TRAIN_HALF > z - 2;
		lowered.current +=
			((ringing ? 1 : 0) - lowered.current) * (1 - Math.exp(-delta * 3));
		const blink = Math.floor(clock.elapsedTime * 2.2) % 2;
		lamps.current.forEach((lamp, i) => {
			const on = ringing && i % 2 === blink;
			lamp.color.set(on ? RED_ON : RED_OFF);
			const halo = halos.current[i];
			if (halo) halo.opacity = on ? 0.6 : 0;
		});
		// Raised, each arm stands up from its post; the two arms point opposite ways along the road.
		booms.current.forEach((boom, i) => {
			boom.rotation.x =
				(i === 0 ? -1 : 1) * (1 - lowered.current) * (Math.PI / 2) * 0.92;
		});
	});

	return (
		<group>
			{/* The road across, and timber boards between the rails. */}
			{sides.map((side) => {
				const x = TRAIN.x + side * (2.1 + ROAD.reach / 2);
				return (
					<mesh
						key={side}
						position={[x, hallHeight(x, z) + 0.05, z]}
						rotation-x={-Math.PI / 2}
					>
						<planeGeometry args={[ROAD.reach, ROAD.width]} />
						<meshStandardMaterial color="#8a8780" roughness={1} />
					</mesh>
				);
			})}
			<mesh position={[TRAIN.x, 0.24, z]}>
				<boxGeometry args={[4.2, 0.1, ROAD.width]} />
				<meshStandardMaterial color="#4a3b30" roughness={1} />
			</mesh>
			{sides.map((side) => {
				// Each side's post stands on its own corner, across the road from the other.
				const postZ = z + side * (ROAD.width / 2 + 0.5);
				const x = TRAIN.x + side * 3.4;
				return (
					<group key={side} position={[x, 0, postZ]}>
						<mesh position={[0, 1.7, 0]}>
							<cylinderGeometry args={[0.09, 0.09, 3.4, 8]} />
							<meshStandardMaterial map={stripeTexture()} roughness={0.8} />
						</mesh>
						{/* Crossbuck and lamps face the visitor's camera, up the track. */}
						<group position={[0, 3.6, 0]}>
							{[-1, 1].map((tilt) => (
								<mesh key={tilt} rotation-z={tilt * 0.62}>
									<boxGeometry args={[1.5, 0.22, 0.04]} />
									<meshStandardMaterial map={stripeTexture()} roughness={0.8} />
								</mesh>
							))}
						</group>
						<group position={[0, 2.75, 0.08]}>
							<mesh>
								<boxGeometry args={[1.1, 0.12, 0.12]} />
								<meshStandardMaterial color="#141414" />
							</mesh>
							{[-0.45, 0.45].map((lx, i) => (
								<group key={lx} position={[lx, -0.05, 0.07]}>
									<mesh>
										<circleGeometry args={[0.17, 16]} />
										<meshBasicMaterial
											ref={(material) => {
												if (material) lamps.current[side + 1 + i] = material;
											}}
											color={RED_OFF}
											toneMapped={false}
										/>
									</mesh>
									<mesh position={[0, 0, 0.02]}>
										<planeGeometry args={[1.8, 1.8]} />
										<meshBasicMaterial
											ref={(material) => {
												if (material) halos.current[side + 1 + i] = material;
											}}
											map={glow}
											color={RED_ON}
											transparent
											opacity={0}
											depthWrite={false}
											blending={AdditiveBlending}
										/>
									</mesh>
								</group>
							))}
						</group>
						{/* The boom pivots on the post and spans the road when down. */}
						<group
							position={[side * -0.25, 1.05, 0]}
							ref={(boom) => {
								if (boom) booms.current[(side + 1) / 2] = boom;
							}}
						>
							<mesh position={[0, 0, -side * 2.6]}>
								<boxGeometry args={[0.08, 0.1, 5.2]} />
								<meshStandardMaterial map={arm} roughness={0.8} />
							</mesh>
						</group>
					</group>
				);
			})}
		</group>
	);
}
