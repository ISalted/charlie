import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Charlie AQA — Playwright config.
 * Reporting is Playwright-native (see .claude/docs/reporting-guide.md): HTML report + traces + JSON.
 * BASE_URL points at stage; goTo(route) is relative to it.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.web.test.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "results.json" }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? "https://stage.allright.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
