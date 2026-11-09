import { describe, expect, it } from "vitest";
import {
	CLEARING_START,
	cameraStage,
	crossingZ,
	grovePlacement,
	hallHeight,
	PLATFORM,
	PROP_WIDTH,
	propSlots,
	sando,
	sandoLength,
	TRAIN,
	TRAIN_HALF,
	trainRun,
} from "./layout";

describe("hall layout", () => {
	it("keeps the track bed level all the way into the valley", () => {
		for (let z = 0; z > -400; z -= 25) {
			expect(Math.abs(hallHeight(TRAIN.x, z))).toBeLessThan(0.5);
		}
	});

	it("puts the groves in pairs in the clearing, one on each side, on gentle ground", () => {
		for (let i = 0; i < 4; i++) {
			const { x, z, y, side, stage } = grovePlacement(i);
			expect(side).toBe(i % 2 === 0 ? -1 : 1);
			expect(-z).toBeGreaterThan(CLEARING_START + 15);
			expect(Math.abs(hallHeight(x + 4, z) - y)).toBeLessThan(2.5);
			// The camera of the grove's stage stands just before it.
			const [, , cz] = cameraStage(stage).position;
			expect(cz - z).toBeGreaterThan(20);
			expect(cz - z).toBeLessThan(60);
		}
	});

	it("runs the train ahead of the camera at every stage", () => {
		for (const stage of [1, 2, 3]) {
			const [, , cz] = cameraStage(stage).position;
			expect(TRAIN.z - trainRun(stage)).toBeLessThan(cz - 15);
		}
	});

	it("starts each sandō past the platform's outer edge, between the grove and the camera", () => {
		const outer = TRAIN.x - (PLATFORM.edge - PLATFORM.width);
		for (let i = 0; i < 4; i++) {
			const { entrance, shrine } = sando(i);
			expect(Math.abs(entrance[0] - TRAIN.x)).toBeGreaterThan(outer + 1);
			expect(entrance[1]).toBeGreaterThan(shrine[1]);
			const [, , cz] = cameraStage(grovePlacement(i).stage).position;
			expect(entrance[1]).toBeLessThan(cz - 15);
		}
	});

	it("puts each level crossing between its pair's torii, ahead of the camera and clear of the standing train", () => {
		for (const pair of [0, 1]) {
			const z = crossingZ(pair);
			const stage = pair + 1;
			const [, , cz] = cameraStage(stage).position;
			const trainRear = TRAIN.z - trainRun(stage) + TRAIN_HALF;
			expect(z).toBeLessThan(cz - 10);
			expect(z - trainRear).toBeGreaterThan(4);
			expect(z).toBe(sando(pair * 2 + 1).entrance[1]);
		}
	});

	it("lays out any number of anime in a grove without two props touching or blocking the sandō", () => {
		for (const count of [1, 3, 6, 10, 11, 20, 35, 50]) {
			for (const index of [0, 1, 2, 3]) {
				const slots = propSlots(index, count);
				expect(slots).toHaveLength(count);
				const path = sando(index, sandoLength(count));
				const curve = Array.from({ length: 101 }, (_, k) => path.at(k / 100));
				for (const [i, a] of slots.entries()) {
					// Clear of the sandō (stones are 1.9 m wide), plus the prop's own half width.
					const distance = Math.min(
						...curve.map(([px, pz]) => Math.hypot(a.x - px, a.z - pz)),
					);
					expect(distance).toBeGreaterThan(1 + (a.scale * PROP_WIDTH) / 2);
					for (const b of slots.slice(i + 1)) {
						const gap = Math.hypot(a.x - b.x, a.z - b.z);
						expect(gap).toBeGreaterThan(
							(((a.scale + b.scale) * PROP_WIDTH) / 2) * 0.98,
						);
					}
				}
			}
		}
	});
});
