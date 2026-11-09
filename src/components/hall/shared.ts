import { CanvasTexture, SRGBColorSpace } from "three";

/** Ask the page to take the visitor somewhere: it plays the departure, then navigates. */
export const go = (url: string) =>
	dispatchEvent(new CustomEvent("hall:go", { detail: url }));

export interface HoverDetail {
	label: string;
	image?: string | null;
}
/** Name what the pointer is over in the page's caption (null: back to the idle caption). */
export const hover = (detail: HoverDetail | null) =>
	dispatchEvent(new CustomEvent("hall:hover", { detail }));

export const random = (seed: number) => () => {
	seed = (seed * 16807) % 2147483647;
	return seed / 2147483647;
};

let glow: CanvasTexture | undefined;
/** A soft round glow, shared by every halo and pool of light. */
export function glowTexture() {
	if (glow) return glow;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 128;
	const g = canvas.getContext("2d") as CanvasRenderingContext2D;
	const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	gradient.addColorStop(0, "rgba(255,255,255,1)");
	gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
	gradient.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = gradient;
	g.fillRect(0, 0, 128, 128);
	glow = new CanvasTexture(canvas);
	glow.colorSpace = SRGBColorSpace;
	return glow;
}
