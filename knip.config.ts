import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreDependencies: [
    // Resolved at runtime by Nimbus's <Icon>, which looks up `ph:*` names in
    // the iconify dataset — never imported as a module.
    "@iconify-json/ph",
    // Search reads /pagefind/pagefind.js in the browser; the CLI indexes the
    // built site. Neither goes through an `import`.
    "pagefind",
    // Used inside `astro check` (@astrojs/check), not by our source.
    "@astrojs/language-server",
  ],
  ignoreIssues: {
    // Nimbus registry components (installed with `nimbus-docs add`) re-export
    // their whole API from index.ts, so their unused exports are upstream's
    // call, not ours — and `add --overwrite` would bring them back anyway.
    "src/components/ui/**": ["exports", "types"],
  },
};

export default config;
