import { describe, expect, it } from "vitest";
import { parseMalId, pickJikan, pickMal, slugify } from "./jikan";

describe("parseMalId", () => {
	it("reads bare ids and MAL URLs", () => {
		expect(parseMalId("59978")).toBe(59978);
		expect(
			parseMalId(
				"https://myanimelist.net/anime/59978/Sousou_no_Frieren_2nd_Season",
			),
		).toBe(59978);
		expect(parseMalId("frieren")).toBeUndefined();
	});
});

describe("slugify", () => {
	it("makes URL-safe slugs", () => {
		expect(slugify("Fate/strange Fake")).toBe("fate-strange-fake");
		expect(slugify("Dr. Stone: Science Future Part 3")).toBe(
			"dr-stone-science-future-part-3",
		);
		expect(slugify("Re:Zero kara Hajimeru Isekai Seikatsu 4th Season")).toBe(
			"re-zero-kara-hajimeru-isekai-seikatsu-4th-season",
		);
	});
});

describe("pickJikan", () => {
	const base = {
		title: "Sousou no Frieren 2nd Season",
		title_japanese: "葬送のフリーレン 第2期",
		title_english: null,
		url: "https://myanimelist.net/anime/59978",
		synopsis: null,
		episodes: 10,
		studios: [{ name: "Madhouse" }],
		aired: { from: "2026-01-16T00:00:00+00:00", to: null },
	};

	it("extracts the trailer id from the embed URL when youtube_id is missing", () => {
		const picked = pickJikan({
			...base,
			trailer: {
				youtube_id: null,
				embed_url:
					"https://www.youtube-nocookie.com/embed/abcDEF12345?autoplay=1",
			},
		});
		expect(picked.trailerYoutubeId).toBe("abcDEF12345");
		expect(picked.studios).toEqual(["Madhouse"]);
	});

	it("accepts a payload without trailer or images", () => {
		expect(pickJikan(base)).toMatchObject({
			trailerYoutubeId: null,
			image: null,
		});
	});
});

describe("pickMal", () => {
	it("maps the official API and takes the newest video as trailer", () => {
		const picked = pickMal({
			id: 59978,
			title: "Sousou no Frieren 2nd Season",
			alternative_titles: { en: "", ja: "葬送のフリーレン 第2期" },
			num_episodes: 10,
			start_date: "2026-01-16",
			videos: [
				{ url: "https://youtu.be/MwP4gqRys4c", created_at: 1 },
				{ url: "https://youtu.be/RH-FcW94z00", created_at: 2 },
			],
		});
		expect(picked).toMatchObject({
			titleEnglish: null,
			titleJapanese: "葬送のフリーレン 第2期",
			studios: [],
			airedTo: null,
			trailerYoutubeId: "RH-FcW94z00",
		});
	});
});
