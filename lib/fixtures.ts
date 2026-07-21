import { test as base, expect } from "@playwright/test";
import { WebClient } from "@pages/allright-app";
import { ApiClient } from "@api/api-client";
import { Helpers } from "@helpers/helpers";
import { env } from "@lib/config";

/**
 * The three fixtures every test uses. Import from here, never from "@playwright/test":
 *   import { test, expect } from "@lib/fixtures";
 */
interface Fixtures {
  /** All UI work — composes the page objects (e.g. .quizPage) + .goTo(route). */
  webClient: WebClient;
  /** The outcome oracle — verify the created user + booking. */
  apiClient: ApiClient;
  /** Generic, page-agnostic utilities. */
  helpers: Helpers;
}

export const test = base.extend<Fixtures>({
  webClient: async ({ page }, use) => {
    await use(new WebClient(page));
  },
  helpers: async ({ page }, use) => {
    await use(new Helpers(page));
  },
  apiClient: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: env.apiUrl || undefined,
    });
    await use(new ApiClient(context));
    await context.dispose();
  },
});

export { expect };
