// GLSL for the painted landscape. Everything is procedural: no texture assets.

const noise = /* glsl */ `
float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise(float x) {
	float i = floor(x), f = fract(x);
	return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}
float fbm(float x) {
	float v = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { v += a * noise(x); x *= 2.03; a *= 0.5; }
	return v;
}
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}
float fbm2(vec2 p) {
	float v = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { v += a * noise2(p); p *= 2.02; a *= 0.5; }
	return v;
}
`;

/** Full-screen quad drawn at the far plane, independent of the camera. */
export const skyVertex = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export const skyFragment = /* glsl */ `
uniform vec3 uTop, uBottom, uSun, uCloud;
uniform float uTime, uOffset, uAspect;
varying vec2 vUv;
${noise}
void main() {
	vec2 uv = vUv;
	vec3 col = mix(uBottom, uTop, smoothstep(0.2, 1.0, uv.y));

	vec2 d = (uv - vec2(0.72, 0.5)) * vec2(uAspect, 1.0);
	float r = length(d);
	col += uSun * (exp(-r * 9.0) * 0.8 + exp(-r * 2.5) * 0.2);
	col = mix(col, uSun, smoothstep(0.042, 0.036, r));

	// Long, layered cumulus bands drifting slowly; the train adds a little parallax.
	vec2 cp = vec2(uv.x * uAspect * 1.4 + uOffset * 0.0015 + uTime * 0.004, uv.y * 4.5);
	float c = fbm2(cp + vec2(0.0, fbm2(cp * 0.6) * 0.8));
	float cloudMask = smoothstep(0.52, 0.72, c) * smoothstep(0.42, 0.7, uv.y);
	vec3 cloud = mix(uCloud, uSun, exp(-r * 3.0) * 0.7);
	cloud = mix(cloud * 0.82 + uBottom * 0.1, cloud, smoothstep(0.52, 0.8, c));
	col = mix(col, cloud, cloudMask * 0.9);

	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

/** Shared by every world-space layer: hands the fragment its world position. */
export const worldVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
	vec4 world = modelMatrix * vec4(position, 1.0);
	vWorld = world.xyz;
	gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** A lake along the track mirroring the sky, with sun glints, fading into the same fog as the land. */
export const waterFragment = /* glsl */ `
uniform vec3 uTop, uBottom, uSun;
uniform float uTime, uCamX, uFogDensity;
uniform vec3 uFog;
varying vec3 vWorld;
${noise}
void main() {
	float distance = length(vWorld - cameraPosition);
	// Grazing angles reflect the bright horizon, closer water shows more of the sky's top.
	// Deep water mirrors the darker top of the sky; only grazing angles catch the bright horizon.
	vec3 col = mix(uTop * 0.5, uBottom * 0.8, smoothstep(20.0, 120.0, distance));
	float ripple = noise(vWorld.x * 0.7 + uTime * 0.5) * noise(vWorld.z * 2.5 - uTime * 0.8);
	col += uSun * smoothstep(0.5, 0.85, ripple) * 0.35;
	col = mix(col, uFog, 1.0 - exp(-pow(distance * uFogDensity, 2.0)));
	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

/** Grass blades swaying in the wind. Each instance carries its base position and tip color. */
export const grassVertex = /* glsl */ `
uniform float uTime, uWind;
attribute vec3 aOffset;
attribute vec3 aColor;
attribute float aScale;
varying vec3 vColor;
varying float vHeight;
varying vec3 vWorld;
void main() {
	vec3 p = position * aScale;
	float bend = uv.y * uv.y;
	float gust = sin(uTime * 1.8 + aOffset.x * 0.25 + aOffset.z * 0.4) + 0.5 * sin(uTime * 3.1 + aOffset.x);
	p.x += gust * uWind * bend;
	p.z += 0.25 * gust * uWind * bend;
	vec4 world = vec4(p + aOffset, 1.0);
	vWorld = world.xyz;
	vColor = aColor;
	vHeight = uv.y;
	gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const grassFragment = /* glsl */ `
uniform vec3 uFog;
uniform float uFogDensity;
varying vec3 vColor;
varying float vHeight;
varying vec3 vWorld;
void main() {
	vec3 col = mix(vColor * 0.55, vColor * 1.08, vHeight);
	float distance = length(vWorld - cameraPosition);
	col = mix(col, uFog, 1.0 - exp(-pow(distance * uFogDensity, 2.0)));
	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

/** Terrain: textured rock, grass and snow, lit by the sun and the sky dome, fading into aerial haze. */
export const terrainVertex = /* glsl */ `
attribute vec3 aGrass;
attribute vec3 aRock;
attribute float aSnowLine;
varying vec3 vWorld, vNormal, vGrass, vRock;
varying float vSnowLine;
void main() {
	vec4 world = modelMatrix * vec4(position, 1.0);
	vWorld = world.xyz;
	vNormal = normalize(mat3(modelMatrix) * normal);
	vGrass = aGrass;
	vRock = aRock;
	vSnowLine = aSnowLine;
	gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const terrainFragment = /* glsl */ `
uniform sampler2D uRock, uRockNormal, uGrass, uGrassNormal, uSnow, uSnowNormal;
uniform vec3 uSun, uSunDir, uSky, uGround, uFog;
uniform float uFogDensity;
varying vec3 vWorld, vNormal, vGrass, vRock;
varying float vSnowLine;

vec3 triplanar(sampler2D map, vec3 p, vec3 w, float scale) {
	return texture2D(map, p.zy * scale).rgb * w.x
		+ texture2D(map, p.xz * scale).rgb * w.y
		+ texture2D(map, p.xy * scale).rgb * w.z;
}

// Whiteout-blended triplanar normal mapping (Ben Golus): no stretching on cliffs.
vec3 triplanarNormal(sampler2D map, vec3 p, vec3 n, vec3 w, float scale) {
	vec3 tx = texture2D(map, p.zy * scale).xyz * 2.0 - 1.0;
	vec3 ty = texture2D(map, p.xz * scale).xyz * 2.0 - 1.0;
	vec3 tz = texture2D(map, p.xy * scale).xyz * 2.0 - 1.0;
	tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
	ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
	tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
	return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}

void main() {
	vec3 n = normalize(vNormal);
	vec3 w = pow(abs(n), vec3(4.0));
	w /= w.x + w.y + w.z;
	float h = vWorld.y;
	float breakup = (texture2D(uRock, vWorld.xz * 0.013).r - 0.5) * 0.3;

	// Grass holds on gentle slopes, rock shows on steep faces, snow only where it can settle.
	float grassAmount = smoothstep(0.66, 0.82, n.y + breakup);
	float snowAmount = smoothstep(vSnowLine, vSnowLine + 8.0, h + breakup * 30.0)
		* smoothstep(0.48, 0.66, n.y + breakup);

	vec3 albedo = mix(
		triplanar(uRock, vWorld, w, 1.0 / 22.0) * vRock * 1.7,
		texture2D(uGrass, vWorld.xz / 9.0).rgb * vGrass * 1.9,
		grassAmount
	);
	vec3 normal = normalize(mix(
		triplanarNormal(uRockNormal, vWorld, n, w, 1.0 / 22.0),
		triplanarNormal(uGrassNormal, vWorld, n, w, 1.0 / 9.0),
		grassAmount
	));
	albedo = mix(albedo, texture2D(uSnow, vWorld.xz / 12.0).rgb * vec3(0.97, 0.99, 1.03), snowAmount);
	normal = normalize(mix(normal, triplanarNormal(uSnowNormal, vWorld, n, w, 1.0 / 12.0), snowAmount));

	// Sun with a gentle wrap so shaded cliffs keep their form, plus the sky dome.
	float sun = max(0.0, (dot(normal, uSunDir) + 0.15) / 1.15);
	vec3 ambient = mix(uGround, uSky, normal.y * 0.5 + 0.5) * 0.45;
	vec3 col = albedo * (ambient + uSun * sun * 1.25);

	// Aerial perspective: farther is paler and bluer, and the haze pools low in the valleys.
	float distance = length(vWorld - cameraPosition);
	float haze = (1.0 - exp(-pow(distance * uFogDensity, 2.0))) * mix(1.0, 0.6, smoothstep(0.0, 160.0, h));
	col = mix(col, uFog, haze);

	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

/** Telegraph poles and their sagging wires rushing past the window. */
export const foreFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uSpacing;
varying vec3 vWorld;
${noise}
void main() {
	float x = vWorld.x, y = vWorld.y;
	float fw = fwidth(y) * 1.2;
	float px = mod(x + uSpacing * 0.5, uSpacing);
	float alpha = step(px, 0.14) * step(y, 5.0);
	alpha = max(alpha, step(abs(y - 4.75), 0.05) * step(abs(px - 0.07), 0.55));
	// High up, near the top of the window, so they never cut across the view.
	float wire = 4.7 - 0.45 * sin(3.14159 * px / uSpacing);
	alpha = max(alpha, 1.0 - smoothstep(0.0, fw * 1.5, abs(y - wire) - 0.008));

	if (alpha <= 0.01) discard;
	gl_FragColor = vec4(uColor, alpha);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

/** Season particles living in world space, wrapped in a box that follows the camera. */
export const particleVertex = /* glsl */ `
uniform float uTime, uFallSpeed, uSway, uSize, uCamX;
attribute vec3 aSeed;
void main() {
	vec3 p = position;
	p.y = mod(p.y - uTime * uFallSpeed * (0.6 + aSeed.x), 22.0) - 6.0;
	p.x += sin(uTime * (0.4 + aSeed.y) + aSeed.z * 6.2831) * uSway;
	p.x = uCamX + mod(p.x - uCamX, 60.0) - 30.0;
	vec4 mv = modelViewMatrix * vec4(p, 1.0);
	gl_PointSize = uSize * (0.6 + aSeed.y) * 180.0 / -mv.z;
	gl_Position = projectionMatrix * mv;
}
`;

export const particleFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
	float d = length(gl_PointCoord - 0.5);
	float alpha = smoothstep(0.5, 0.15, d) * uOpacity;
	if (alpha < 0.01) discard;
	gl_FragColor = vec4(uColor, alpha);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;
