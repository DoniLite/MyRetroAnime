import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://myretroanime.donilite.me",
	trailingSlash: "always",
	integrations: [mdx(), react()],
});
