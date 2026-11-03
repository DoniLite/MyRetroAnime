import { z } from "astro/zod";

/** The subset of Jikan's /anime/{id} payload we keep, cached as jikan.json next to each anime. */
export const jikanSchema = z.object({
	title: z.string(),
	titleJapanese: z.string().nullable(),
	titleEnglish: z.string().nullable(),
	url: z.string(),
	image: z.string().nullable(),
	synopsis: z.string().nullable(),
	episodes: z.number().int().nullable(),
	studios: z.array(z.string()),
	airedFrom: z.string().nullable(),
	airedTo: z.string().nullable(),
	trailerYoutubeId: z.string().nullable(),
});
export type Jikan = z.infer<typeof jikanSchema>;

interface JikanAnime {
	title: string;
	title_japanese: string | null;
	title_english: string | null;
	url: string;
	images?: { webp?: { large_image_url?: string | null } };
	synopsis: string | null;
	episodes: number | null;
	studios: { name: string }[];
	aired: { from: string | null; to: string | null };
	trailer?: { youtube_id: string | null; embed_url: string | null };
}

export function pickJikan(anime: JikanAnime): Jikan {
	const embedId = anime.trailer?.embed_url?.match(/embed\/([\w-]{11})/)?.[1];
	return {
		title: anime.title,
		titleJapanese: anime.title_japanese,
		titleEnglish: anime.title_english,
		url: anime.url,
		image: anime.images?.webp?.large_image_url ?? null,
		synopsis: anime.synopsis,
		episodes: anime.episodes,
		studios: anime.studios.map((studio) => studio.name),
		airedFrom: anime.aired.from,
		airedTo: anime.aired.to,
		// Jikan sometimes leaves youtube_id empty but keeps the embed URL.
		trailerYoutubeId: anime.trailer?.youtube_id ?? embedId ?? null,
	};
}

export async function fetchJikan(malId: number): Promise<Jikan> {
	const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
	if (!response.ok) throw new Error(`Jikan ${malId}: HTTP ${response.status}`);
	const { data } = (await response.json()) as { data: JikanAnime };
	return pickJikan(data);
}

interface MalAnime {
	id: number;
	title: string;
	main_picture?: { large?: string; medium: string };
	alternative_titles?: { en?: string; ja?: string };
	synopsis?: string;
	num_episodes?: number;
	studios?: { name: string }[];
	start_date?: string;
	end_date?: string;
	videos?: { url: string; created_at: number }[];
}

/** Maps the official MAL API v2 payload to the same cache shape as Jikan. */
export function pickMal(anime: MalAnime): Jikan {
	// shortcut: the newest MAL video is taken as the trailer; set overrides.trailerYoutubeId when it picks the wrong one.
	const newest = anime.videos?.toSorted(
		(a, b) => b.created_at - a.created_at,
	)[0];
	return {
		title: anime.title,
		titleJapanese: anime.alternative_titles?.ja || null,
		titleEnglish: anime.alternative_titles?.en || null,
		url: `https://myanimelist.net/anime/${anime.id}`,
		image: anime.main_picture?.large ?? anime.main_picture?.medium ?? null,
		synopsis: anime.synopsis || null,
		episodes: anime.num_episodes || null,
		studios: anime.studios?.map((studio) => studio.name) ?? [],
		airedFrom: anime.start_date ?? null,
		airedTo: anime.end_date ?? null,
		trailerYoutubeId:
			newest?.url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/)?.[1] ?? null,
	};
}

export async function fetchMal(
	malId: number,
	clientId: string,
): Promise<Jikan> {
	const fields =
		"alternative_titles,main_picture,synopsis,num_episodes,studios,start_date,end_date,videos";
	const response = await fetch(
		`https://api.myanimelist.net/v2/anime/${malId}?fields=${fields}`,
		{ headers: { "X-MAL-CLIENT-ID": clientId } },
	);
	if (!response.ok) throw new Error(`MAL ${malId}: HTTP ${response.status}`);
	return pickMal((await response.json()) as MalAnime);
}

/** Official MAL API when MAL_CLIENT_ID is set (scripts load .env), Jikan otherwise. */
export function fetchAnime(malId: number): Promise<Jikan> {
	const clientId = process.env.MAL_CLIENT_ID;
	return clientId ? fetchMal(malId, clientId) : fetchJikan(malId);
}

/** Accepts a bare id or any myanimelist.net/anime/{id}/… URL. */
export function parseMalId(input: string): number | undefined {
	const id = Number(input.match(/anime\/(\d+)/)?.[1] ?? input);
	return Number.isInteger(id) && id > 0 ? id : undefined;
}

export function slugify(title: string): string {
	return title
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}
