import { describe, expect, it } from "vitest";
import { pickLocalized } from "./i18n";

describe("pickLocalized", () => {
	it("prefers the requested language", () => {
		expect(pickLocalized({ en: "hi", fr: "salut" }, "fr")).toEqual({
			value: "salut",
			lang: "fr",
		});
	});
	it("falls back to the other language", () => {
		expect(pickLocalized({ fr: "salut" }, "en")).toEqual({
			value: "salut",
			lang: "fr",
		});
	});
	it("returns undefined when nothing exists", () => {
		expect(pickLocalized({}, "en")).toBeUndefined();
	});
});
