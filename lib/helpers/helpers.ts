import type { Page, Response } from "@playwright/test";
import { step } from "@helpers/step";
import type { QuizOutcome, QuizRunResult } from "@pages/quiz.types";

/**
 * Generic, page-agnostic utilities reached in tests via the `helpers` fixture.
 * Hosts the NETWORK-INTERCEPT outcome oracle: it observes the real create/booking requests the
 * browser makes, so it needs no separate API auth (the fresh api-client context can't share the
 * quiz's session). This is the primary, variant-independent business check for the funnel.
 */
export class Helpers {
  constructor(private readonly page: Page) {}

  /** Resolve when a request matching `urlPart` returns a 2xx. Generic building block. */
  @step()
  async waitForOkResponse(urlPart: string, timeoutMs = 30_000): Promise<Response> {
    return this.page.waitForResponse(
      (res) => res.url().includes(urlPart) && res.status() >= 200 && res.status() < 300,
      { timeout: timeoutMs },
    );
  }

  /**
   * Run a quiz-completion action while watching for the two outcome POSTs, and RETURN what
   * happened for the test to assert:
   *   • account created → `POST /api/v1/users` 2xx
   *   • trial booked    → `POST /api/v1/lessons` 2xx
   * The watchers are armed BEFORE the action so the requests can't be missed.
   */
  @step()
  async captureQuizOutcome(run: () => Promise<QuizRunResult>, timeoutMs = 180_000): Promise<QuizOutcome> {
    const isPost = (method: string) => method === "POST";
    const userReq = this.page
      .waitForResponse((r) => /\/api\/v1\/users(\?|$)/.test(r.url()) && isPost(r.request().method()), {
        timeout: timeoutMs,
      })
      .catch(() => null);
    const lessonReq = this.page
      .waitForResponse((r) => /\/api\/v1\/lessons(\?|$)/.test(r.url()) && isPost(r.request().method()), {
        timeout: timeoutMs,
      })
      .catch(() => null);

    const runResult = await run();
    const [userRes, lessonRes] = await Promise.all([userReq, lessonReq]);

    return {
      runResult,
      accountCreated: !!userRes && userRes.ok(),
      trialBooked: !!lessonRes && lessonRes.ok(),
    };
  }
}
