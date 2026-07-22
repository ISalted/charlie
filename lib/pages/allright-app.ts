import { BasePage } from "@pages/base.page";
import { QuizMixin } from "@pages/mixins";

/**
 * Known direct routes, relative to baseURL. Use webClient.goTo(AppRoute.quizEntry) — never a full URL.
 */
export const AppRoute = {
  quizEntry: "/uk/app/sign-up/long/charlie/age-range",
} as const;
export type AppRoute = (typeof AppRoute)[keyof typeof AppRoute];

/**
 * WebClient — the single UI entrypoint a test uses (via the `webClient` fixture).
 * Composes PAGE mixins only; components are reached through their page
 * (e.g. webClient.quizPage.<component>). Exposes `.page` raw only when unavoidable.
 */
export class WebClient extends QuizMixin(BasePage) {
  async goTo(route: string): Promise<void> {
    await this.page.goto(route);
  }
}
