import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import nimbus, {
  defineConfig as defineNimbusConfig,
} from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";

const nimbusConfig = defineNimbusConfig({
  // CHANGE_ME: your site's canonical origin (no trailing slash). Drives
  // canonical URLs, absolute OG image URLs, robots.txt, sitemap, and the
  // links in /llms.txt — leaving the placeholder breaks all of them.
  site: "https://racecourses-memo.koralle-mgmg.com",
  // CHANGE_ME: your project's name — used for <title>, the home H1, and OG.
  title: "競馬場メモ",
  // CHANGE_ME: a one-line description of your docs — used for meta + OG.
  description: "全国の競馬場をコース・アクセス・開催の観点でまとめるメモ",
  locale: "ja",
  // CHANGE_ME: your repository — shown as the GitHub link in the header.
  github: "https://github.com/koralle/horse-racecourses-memo",
  socialImageAlt: "競馬場メモのプレビュー画像",
  // The home page leads the sidebar; every other page joins it automatically.
  sidebar: {
    items: ["index", { autogenerate: { collection: "docs" } }],
  },
});

export default defineConfig({
  // nimbus:adapter
  output: "server",
  // Prerender in Node, not workerd: Nimbus generates OG images with satori +
  // resvg, which cannot load inside the workerd prerender sandbox.
  adapter: cloudflare({ prerenderEnvironment: "node" }),

  // Tailwind v4 via its Vite plugin (the integration Astro recommends for
  // Tailwind v4 — replaces the PostCSS plugin, which doesn't build under
  // Astro 7's Vite 8 bundler).
  vite: {
    plugins: [tailwindcss()],
  },

  // Hover-prefetch link targets so full-page navigations feel instant without
  // a client-side router.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },

  integrations: [
    nimbus(nimbusConfig, {
      // Authoring rules are opt-in by design, so severities live here. Build
      // validators (frontmatter schema, MDX syntax, route collisions) run on
      // their own and gate the build; these run only when `lint` asks for
      // them. `.nimbus/lint.json` is written by `astro build` and is what the
      // CLI reads — build before linting.
      rules: {
        // `error`: the page is broken for a reader or an agent. Fails lint.
        "nimbus/frontmatter-shape": "error",
        "nimbus/description-required": "error",
        "nimbus/internal-link": "error",
        "nimbus/redirected-link": "error",
        "nimbus/image-ref": "error",
        "nimbus/no-self-host-url": "error",
        "nimbus/single-h1": "error",
        "nimbus/heading-hierarchy": "error",
        "nimbus/duplicate-heading-text": "error",
        "nimbus/code-block-lang": "error",
        // `warn`: typography and consistency. Loud, but doesn't fail the run.
        "nimbus/code-block-prompt-prefix": "warn",
        "nimbus/heading-punctuation": "warn",
        "nimbus/emphasis-style": "warn",
        "nimbus/list-marker-style": "warn",
        // `nimbus/bare-url` stays off: every 出典 section lists its sources as
        // bare URLs on purpose. Preview what it wants with
        // `nimbus-docs lint --rule nimbus/bare-url` before enabling it.
      },
      collections: {
        // Partials are fragments inlined into another page, so they carry no
        // description and no fixed heading level to check.
        partials: {
          rules: {
            "nimbus/description-required": "off",
            "nimbus/single-h1": "off",
            "nimbus/heading-hierarchy": "off",
          },
        },
      },
      markdown: {
        // Wrap wide tables so they scroll instead of overflowing the page
        // (styled by `.nb-table-scroll` in src/styles/prose.css).
        hastPlugins: [tableScroll()],
        // `## Install {#install}` gives a heading a fixed id. A heading that
        // ends in other `{…}` text, such as `{account_id}` in a .md file, is
        // read as attributes too; remove this to keep it as text.
        features: { headingAttributes: true },
      },
    }),
  ],
});