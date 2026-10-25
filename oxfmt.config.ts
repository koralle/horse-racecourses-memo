import { defineConfig } from "oxfmt";

export default defineConfig({
  // `.astro` is formatted through prettier-plugin-astro, which needs
  // @astrojs/compiler-rs installed (it ships in devDependencies).
  astro: true,
  // Content is authored prose: Nimbus renders it as written, so its line
  // breaks and MDX stay untouched. Markdown docs at the root are read by
  // humans and agents, not compiled — same treatment.
  ignorePatterns: ["src/content/**", "*.md"],
});
