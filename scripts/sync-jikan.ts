// Refresh every cached jikan.json (episodes, trailers… change while a show airs). Commit the result.
// A failed fetch keeps the previous cache, so a Jikan outage never breaks the site.
import { writeFile } from "node:fs/promises";
import { Glob } from "bun";
import { fetchJikan } from "../src/lib/jikan";

let failed = 0;
for await (const path of new Glob("src/content/*/*/meta.json").scan()) {
	const { malId } = (await Bun.file(path).json()) as { malId: number };
	const target = path.replace(/meta\.json$/, "jikan.json");
	try {
		await writeFile(
			target,
			`${JSON.stringify(await fetchJikan(malId), null, "\t")}\n`,
		);
		console.log(`✓ ${target}`);
	} catch (error) {
		console.error(`✗ ${target}: ${(error as Error).message}`);
		failed++;
	}
	await Bun.sleep(400); // Jikan allows 3 requests per second.
}
process.exitCode = failed > 0 ? 1 : 0;
