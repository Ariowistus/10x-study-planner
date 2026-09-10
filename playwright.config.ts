import process from "node:process";

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4321);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end configuration.
 *
 * The suite runs against a production build served by the Node adapter, which
 * is the same code path the deployed application uses apart from its server
 * entrypoint. It needs a Supabase instance; in CI that is the local stack
 * started by the Supabase CLI.
 */
export default defineConfig({
  testDir: "./e2e",
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
        },
      },
});
