import { expect, it } from "vitest";
import { mediumPoster } from "./poster";

it("drops MAL's large-size suffix, and leaves other URLs alone", () => {
	expect(
		mediumPoster("https://cdn.myanimelist.net/images/anime/1508/152472l.jpg"),
	).toBe("https://cdn.myanimelist.net/images/anime/1508/152472.jpg");
	expect(
		mediumPoster("https://cdn.myanimelist.net/images/anime/1/2l.webp"),
	).toBe("https://cdn.myanimelist.net/images/anime/1/2.webp");
	expect(mediumPoster("https://example.com/hall.jpg")).toBe(
		"https://example.com/hall.jpg",
	);
});
