import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4321);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);

/**
 * Reads a `.env` file into a plain object.
 *
 * Astro loads `.env` during dev and build, but the built server is started as a
 * plain Node process and does not. Without this the suite would run against an
 * application that believes Supabase is not configured, and every test would
 * fail for a reason that has nothing to do with the code under test.
 */
function loadEnvFile(file: string): Partial<Record<string, string>> {
  const values: Partial<Record<string, string>> = {};
  if (!fs.existsSync(file)) {
    return values;
  }

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return values;
}

const fileEnv = loadEnvFile(path.resolve(process.cwd(), ".env"));
const supabaseUrl = process.env.SUPABASE_URL ?? fileEnv.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_KEY ?? fileEnv.SUPABASE_KEY ?? "";

/**
 * End-to-end configuration.
 *
 * The suite runs against a production build served by the Node adapter, which
 * is the same code path the deployed application uses apart from its server
 * entrypoint. It needs a Supabase instance: locally the one named in `.env`,
 * in CI the local stack started by the Supabase CLI.
 */
export default defineConfig({
  testDir: "./e2e",
  // The screenshot pass is a look-at-it tool, not a check. It asserts nothing
  // and creates accounts, so it stays out of the normal run and out of CI.
  testIgnore: process.env.E2E_SHOTS ? [] : ["**/shots.spec.ts"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          PORT: String(PORT),
          HOST: "127.0.0.1",
          SUPABASE_URL: supabaseUrl,
          SUPABASE_KEY: supabaseKey,
        },
      },
});
