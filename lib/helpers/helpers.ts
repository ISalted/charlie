import type { Page, Response } from "@playwright/test";

/**
 * Generic, page-agnostic utilities ONLY. No page flows, no selectors, no test data.
 * Reached in tests via the `helpers` fixture.
 */
export class Helpers {
  constructor(private readonly page: Page) {}

  /**
   * Network-intercept oracle fallback: resolve when a request whose URL matches `urlPart`
   * returns a 2xx response. Used to assert the create/booking call succeeded when the API
   * oracle is unavailable. Returns the matched Response for further payload assertions.
   */
  async waitForOkResponse(urlPart: string, timeoutMs = 30_000): Promise<Response> {
    return this.page.waitForResponse(
      (res) => res.url().includes(urlPart) && res.status() >= 200 && res.status() < 300,
      { timeout: timeoutMs },
    );
  }
}
