import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { jikanSchema } from "./lib/jikan";
import { SEASONS } from "./lib/seasons";

// Every anime lives in src/content/<year>/<slug>/; entry ids are "<year>/<slug>" (+ "/<lang>" for text).
const base = "src/content";
const idFrom =
	(suffix: RegExp) =>
	({ entry }: { entry: string }) =>
		entry.replace(suffix, "");

const score = z.number().min(0).max(10);

const meta = defineCollection({
	loader: glob({
		base,
		pattern: "*/*/meta.json",
		generateId: idFrom(/\/meta\.json$/),
	}),
	schema: z
		.object({
			malId: z.number().int().positive(),
			status: z.enum(["finished", "watching", "planned"]),
			/** Season of the giga season (the folder year) where the anime sits on the line. */
			season: z.enum(SEASONS).optional(),
			episodesWatched: z.number().int().nonnegative().optional(),
			score: score.nullable().default(null),
			criteria: z
				.array(
					z.object({
						label: z.object({ en: z.string(), fr: z.string() }),
						score,
					}),
				)
				.default([]),
			overrides: jikanSchema.partial().default({}),
		})
		.refine((m) => m.status === "planned" || m.season, {
			message: "season is required unless status is planned",
		}),
});

const jikan = defineCollection({
	loader: glob({
		base,
		pattern: "*/*/jikan.json",
		generateId: idFrom(/\/jikan\.json$/),
	}),
	schema: jikanSchema,
});

const text = defineCollection({
	loader: glob({
		base,
		pattern: "*/*/{en,fr}.mdx",
		generateId: idFrom(/\.mdx$/),
	}),
	schema: z.object({ pitch: z.string().optional() }),
});

export const collections = { meta, jikan, text };
