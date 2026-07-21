import type { Page } from "@playwright/test";
import { QuizPage } from "@pages/quiz.page";

/**
 * Page mixins compose page objects into WebClient (see allright-app.ts).
 * A NEW page object gets a mixin here, then is wired into the WebClient chain.
 * Component objects are NOT wired here — they mix into the PAGES that render them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;
interface HasPage {
  readonly page: Page;
}

export function QuizMixin<TBase extends Constructor<HasPage>>(Base: TBase) {
  return class extends Base {
    readonly quizPage = new QuizPage(this.page);
  };
}
