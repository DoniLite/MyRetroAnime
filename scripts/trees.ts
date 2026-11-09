// Generate the 2026 line's trees with ez-tree (MIT, Daniel Greenheck) and bake their geometry into
// assets/models/2026/trees.glb. Textures are not exported: the scene supplies its own, tinted per season.
// Usage: bun scripts/trees.ts, then `bun run assets` quantizes and compresses it into public/.
import { Document, NodeIO } from "@gltf-transform/core";

// ez-tree loads its textures through three's ImageLoader, which needs a DOM: a stub is enough
// because only the geometry is kept.
(globalThis as unknown as { document: unknown }).document = {
	createElementNS: () => ({
		addEventListener() {},
		removeEventListener() {},
		set src(_: string) {},
	}),
};
const { Tree } = await import("@dgreenheck/ez-tree");

/** Preset, seeds, and the height (world units) the tree is scaled to. */
const VARIANTS = [
	{ id: "oak", preset: "Oak Medium", seeds: [11, 23], height: 10 },
	{ id: "oak_large", preset: "Oak Large", seeds: [7], height: 13 },
	{ id: "pine", preset: "Pine Medium", seeds: [5, 31], height: 12 },
	{ id: "pine_large", preset: "Pine Large", seeds: [17], height: 16 },
	{ id: "aspen", preset: "Aspen Medium", seeds: [3, 41], height: 11 },
	{ id: "bush", preset: "Bush 2", seeds: [2, 9], height: 2.4 },
] as const;

type Levels = Record<string, number>;

/** Web-friendly detail: fewer sections and sides per branch, single leaf cards, fewer but larger leaves. */
function lighten(options: {
	branch: { sections: Levels; segments: Levels };
	leaves: { billboard: string; count: number; size: number };
}) {
	for (const level of Object.keys(options.branch.segments)) {
		options.branch.segments[level] = Math.max(
			3,
			Math.round((options.branch.segments[level] ?? 3) * 0.65),
		);
		options.branch.sections[level] = Math.max(
			1,
			Math.round((options.branch.sections[level] ?? 1) * 0.6),
		);
	}
	options.leaves.billboard = "single";
	options.leaves.count = Math.max(4, Math.round(options.leaves.count * 0.85));
	options.leaves.size *= 1.6;
}

const document = new Document();
const buffer = document.createBuffer();
const scene = document.createScene("trees");
let total = 0;

for (const variant of VARIANTS) {
	for (const [n, seed] of variant.seeds.entries()) {
		const tree = new Tree();
		tree.loadPreset(variant.preset);
		tree.options.seed = seed;
		lighten(tree.options as unknown as Parameters<typeof lighten>[0]);
		tree.generate();

		const parts = {
			branches: tree.branchesMesh.geometry,
			leaves: tree.leavesMesh.geometry,
		};
		parts.branches.computeBoundingBox();
		parts.leaves.computeBoundingBox();
		const box = parts.branches.boundingBox?.union(
			parts.leaves.boundingBox ?? parts.branches.boundingBox,
		);
		const scale = box ? variant.height / (box.max.y - box.min.y) : 1;
		const name = `${variant.id}_${n + 1}`;

		for (const [part, geometry] of Object.entries(parts)) {
			geometry.scale(scale, scale, scale);
			const primitive = document.createPrimitive();
			for (const [attribute, gltfName, size] of [
				["position", "POSITION", 3],
				["normal", "NORMAL", 3],
				["uv", "TEXCOORD_0", 2],
			] as const) {
				const array = geometry.getAttribute(attribute).array as Float32Array;
				primitive.setAttribute(
					gltfName,
					document
						.createAccessor()
						.setType(size === 3 ? "VEC3" : "VEC2")
						.setArray(new Float32Array(array))
						.setBuffer(buffer),
				);
			}
			const index = geometry.getIndex();
			if (index) {
				primitive.setIndices(
					document
						.createAccessor()
						.setType("SCALAR")
						.setArray(new Uint32Array(index.array))
						.setBuffer(buffer),
				);
			}
			total += (index?.count ?? 0) / 3;
			const mesh = document
				.createMesh(`${name}_${part}`)
				.addPrimitive(primitive);
			scene.addChild(document.createNode(`${name}_${part}`).setMesh(mesh));
		}
		console.log(
			`✓ ${name}: ${Math.round(((tree.branchesMesh.geometry.index?.count ?? 0) + (tree.leavesMesh.geometry.index?.count ?? 0)) / 3)} triangles`,
		);
	}
}

await new NodeIO().write("assets/models/2026/trees.glb", document);
console.log(`trees.glb written, ${total} triangles in total`);
