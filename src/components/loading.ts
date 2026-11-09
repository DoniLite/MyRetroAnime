import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * A GLTFLoader for the meshopt-compressed models that `bun run assets` writes. Every chunk of a model that
 * arrives reports progress, so one large download keeps the page's watchdog awake.
 */
export function gltfLoader() {
	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	const load = loader.load.bind(loader);
	loader.load = (url, onLoad, onProgress, onError) =>
		load(
			url,
			onLoad,
			(event) => {
				reportProgress();
				onProgress?.(event);
			},
			onError,
		);
	return loader;
}

let fraction = 0;
/**
 * Tell the page the scene is still loading, and how far along it is (0 to 1). Every call keeps the page's
 * stall watchdog (LoadingTrain.astro) from falling back to 2D: call it as files finish and as bytes stream
 * in, so a slow but working connection always gets the 3D scene.
 */
export function reportProgress(next = fraction) {
	fraction = Math.max(fraction, Math.min(1, next));
	dispatchEvent(new CustomEvent("scene:progress", { detail: fraction }));
}
