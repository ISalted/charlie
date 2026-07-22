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
   * Run a quiz-completion action while watching for the account-create POST, and RETURN what happened
   * for the test to assert:
   *   • account created → `POST /api/v1/users` 2xx
   * This is the one backend mutation the funnel always makes and we can see without API creds. The
   * "trial booked" half is a trial REQUEST in the live variant (no `POST /api/v1/lessons` fires) — its
   * proof is reaching the `/app/request-gotten` confirmation, carried in `runResult.reachedEnd`.
   * The watcher is armed BEFORE the action so the request can't be missed.
   */
  @step()
  async captureQuizOutcome(run: () => Promise<QuizRunResult>, timeoutMs = 180_000): Promise<QuizOutcome> {
    const userReq = this.page
      .waitForResponse(
        (r) => /\/api\/v1\/users(\?|$)/.test(r.url()) && r.request().method() === "POST",
        { timeout: timeoutMs },
      )
      .catch(() => null);

    const runResult = await run();
    const userRes = await userReq;

    return {
      runResult,
      accountCreated: !!userRes && userRes.ok(),
    };
  }
}
