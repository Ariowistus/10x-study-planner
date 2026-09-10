// @ts-check
import process from "node:process";

import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";

/**
 * Adapter selection.
 *
 * The Cloudflare adapter boots the `workerd` runtime through miniflare during
 * `astro dev` and `astro build`. On the maintainer's Windows machine that
 * runtime aborts with an access violation, which makes the whole local loop
 * unusable. See context/foundation/infrastructure.md for the full decision
 * record.
 *
 * Local work therefore runs on the Node adapter, and the Cloudflare build is
 * produced on Linux in CI, where `workerd` starts normally.
 */
const deployTarget = process.env.DEPLOY_TARGET ?? "node";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: deployTarget === "cloudflare" ? cloudflare() : node({ mode: "standalone" }),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
