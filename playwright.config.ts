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
  // Cap every locator action: with no actionTimeout a single read of an absent element
  // (e.g. `[data-step-name]` on the terminal page) auto-waits until the whole test times out —
  // one such read ate 26s in a real run. 15s is generous for the live funnel yet bounds any stall.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL ?? "https://stage.allright.com",
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: {
          width: 1700,
          height: 1025,
        },
      },
    },
  ],
});
