import { useMemo } from "react";
import { ShaderMaterial } from "three";
import { GROUND_Y } from "./terrain";

/**
 * Being on board the KiHa 32: the ground right under the window blurred by speed. The window's frame is
 * the page's (.window in YearLine); the camera's sway, joints and braking live in Line's frame loop.
 */

type Uniform<T> = { value: T };

/**
 * The ballast and the neighbouring track right under the window, smeared into streaks along the line while
 * the train runs, fading out as it stops so the station's rails and sleepers come back sharp.
 */
export function SpeedBlur({
	speed,
	camX,
}: {
	speed: Uniform<number>;
	camX: Uniform<number>;
}) {
	const material = useMemo(
		() =>
			new ShaderMaterial({
				transparent: true,
				depthWrite: false,
				uniforms: { uSpeed: speed, uCamX: camX },
				vertexShader: /* glsl */ `
					uniform float uCamX;
					varying vec2 vWorld;
					void main() {
						vec4 world = modelMatrix * vec4(position, 1.0);
						world.x += uCamX;
						vWorld = world.xz;
						gl_Position = projectionMatrix * viewMatrix * world;
					}
				`,
				fragmentShader: /* glsl */ `
					uniform float uSpeed;
					varying vec2 vWorld;
					float hash(float n) { return fract(sin(n) * 43758.5453); }
					float lines(float z) {
						float i = floor(z), f = fract(z);
						return mix(hash(i), hash(i + 1.0), smoothstep(0.0, 1.0, f));
					}
					void main() {
						// Streaks: colour varies across the line only, as gravel does when it rushes past.
						float n = lines(vWorld.y * 9.0) * 0.6 + lines(vWorld.y * 31.0) * 0.4;
						vec3 col = mix(vec3(0.16, 0.14, 0.13), vec3(0.34, 0.31, 0.28), n);
						// Darker over the rails' band, so the track still reads as a track.
						col *= 1.0 - 0.35 * smoothstep(1.2, 0.2, abs(vWorld.y + 1.5));
						// Fade at both ends of the strip, and with speed.
						float ends = smoothstep(0.0, 0.6, vWorld.y + 4.5) * smoothstep(0.0, 1.5, 3.0 - vWorld.y);
						gl_FragColor = vec4(col, smoothstep(0.08, 0.45, uSpeed) * ends);
						#include <tonemapping_fragment>
						#include <colorspace_fragment>
					}
				`,
			}),
		[speed, camX],
	);
	return (
		<mesh
			position={[0, GROUND_Y + 0.3, -0.75]}
			rotation-x={-Math.PI / 2}
			frustumCulled={false}
			renderOrder={2}
			material={material}
		>
			<planeGeometry args={[90, 7.5]} />
		</mesh>
	);
}
