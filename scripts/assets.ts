// Compress the scenes' assets for slow connections: sources in assets/, served copies in public/.
// Textures become WebP; models get quantized and meshopt-compressed (decoded in the browser by three's
// MeshoptDecoder). Usage: bun run assets (the build never runs it; commit the outputs).
import { mkdir } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
	dedup,
	dequantize,
	meshopt,
	prune,
	quantize,
	reorder,
	textureCompress,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

await MeshoptEncoder.ready;
const io = new NodeIO()
	.registerExtensions(ALL_EXTENSIONS)
	.registerDependencies({
		"meshopt.encoder": MeshoptEncoder,
		"meshopt.decoder": MeshoptDecoder,
	});

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

// Textures: lossy WebP; normal maps a little finer so the lighting keeps its grain.
for await (const source of new Bun.Glob(
	"assets/textures/**/*.{jpg,png}",
).scan()) {
	const target = `public/${relative("assets", source).replace(/\.(jpg|png)$/, ".webp")}`;
	await mkdir(dirname(target), { recursive: true });
	const normal = source.includes("_normal");
	// Bark only ever covers thin trunks a few pixels wide: 256 px is plenty.
	const bark = source.includes("/bark_");
	const { size } = await sharp(source)
		.resize(bark ? 256 : undefined)
		.webp({ quality: normal ? 85 : 78, alphaQuality: 90, effort: 6 })
		.toFile(target);
	console.log(`${target}: ${kb(Bun.file(source).size)} -> ${kb(size)}`);
}

const models = [
	{
		source: "assets/models/2026/trees.glb",
		target: "public/models/2026/trees.glb",
	},
	{
		source: "assets/models/hall/kiha32/scene.gltf",
		target: "public/models/hall/kiha32.glb",
	},
];
for (const { source, target } of models) {
	const document = await io.read(source);
	await document.transform(
		dedup(),
		prune(),
		textureCompress({ encoder: sharp, targetFormat: "webp", quality: 80 }),
		reorder({ encoder: MeshoptEncoder }),
		// The trees come in already quantized at the default precision: undo it to quantize coarser.
		dequantize(),
		// Coarser than the defaults (14/10/12 bits): invisible at the scenes' distances, much smaller.
		quantize({ quantizePosition: 12, quantizeNormal: 8, quantizeTexcoord: 10 }),
		meshopt({ encoder: MeshoptEncoder, level: "high" }),
	);
	await mkdir(dirname(target), { recursive: true });
	await io.write(target, document);
	console.log(`${target}: ${kb(Bun.file(target).size)}`);
}
