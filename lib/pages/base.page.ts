import type { Page } from "@playwright/test";

/**
 * Base for every page/component object. Holds the raw Playwright `page`.
 * Locators are PRIVATE fields on subclasses; public methods act-and-return + `@step`.
 * Tests never touch selectors — only object methods.
 */
export class BasePage {
  constructor(readonly page: Page) {}

  /** Sleep in SECONDS (not ms). Prefer real waits over sleeps. */
  async waitForTimeout(seconds: number): Promise<void> {
    await this.page.waitForTimeout(seconds * 1000);
  }
}
