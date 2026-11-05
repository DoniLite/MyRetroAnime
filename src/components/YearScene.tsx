import { type ComponentType, useCallback, useEffect, useState } from "react";
import type { SceneProps, Stop } from "../years/types";

// Each year's scene is its own lazy chunk: a 2026 visitor never downloads 2027's.
const scenes = import.meta.glob<{ default: ComponentType<SceneProps> }>(
	"../years/*/Scene.tsx",
);

/**
 * Mounts the year's 3D layer. The page already chose 3D or 2D before rendering (inline script in
 * YearLine), so there is no flash: this only falls back to 2D if the scene cannot load after all.
 */
export default function YearScene({
	year,
	stops,
}: {
	year: number;
	stops: Stop[];
}) {
	const [Scene, setScene] = useState<ComponentType<SceneProps>>();

	useEffect(() => {
		const root = document.documentElement;
		if (!root.classList.contains("has-3d")) return;
		const fallBack = () => root.classList.remove("has-3d", "scene-loading");
		const load = scenes[`../years/${year}/Scene.tsx`];
		if (!load) return fallBack();
		let cancelled = false;
		load()
			.then((module) => {
				if (!cancelled) setScene(() => module.default);
			})
			.catch(fallBack);
		return () => {
			cancelled = true;
		};
	}, [year]);

	const onReady = useCallback(() => {
		document.documentElement.classList.remove("scene-loading");
		window.dispatchEvent(new Event("line:3d"));
	}, []);
	const onFail = useCallback(() => {
		document.documentElement.classList.remove("has-3d", "scene-loading");
		setScene(undefined);
	}, []);

	return Scene ? (
		<Scene stops={stops} onReady={onReady} onFail={onFail} />
	) : null;
}
