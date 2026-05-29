// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // pdfjs-dist is browser-only (dynamically imported from React islands).
    // Excluding it from SSR optimization prevents Vite from pre-bundling it
    // into the server graph, which otherwise pulls a second React copy into
    // SSR and triggers "Invalid hook call" errors across unrelated islands.
    optimizeDeps: {
      exclude: ["pdfjs-dist"],
    },
    ssr: {
      external: ["pdfjs-dist"],
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENAI_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENAI_MODEL: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
