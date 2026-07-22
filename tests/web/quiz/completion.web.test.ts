import { test, expect } from "@lib/fixtures";
import { AppRoute } from "@pages/allright-app";
import { quizLead } from "@data/quiz/quiz-lead.data";

/**
 * Part B — Variant 1: a resilient business-outcome check.
 *
 * Drives WHATEVER A/B variant is served to completion (generic, shape-based engine — no per-step
 * script) and asserts the variant-independent business result: account created + trial booked,
 * confirmed from the real network requests.
 *
 * @mutating — a green run creates real entities on stage (a user + a trial booking). This is a
 * CI / scheduled-monitor test with synthetic tagged leads, NOT a casual local run.
 */
test.describe("Charlie quiz — completion @web @quiz @completion @mutating", () => {
  test.beforeEach(async ({ webClient }) => {
    await webClient.goTo(AppRoute.quizEntry);
  });

  test.only("QZ-002: completing the quiz creates the account and books a trial @web @quiz @completion @mutating", async ({
    webClient,
    helpers,
  }) => {
    // Completing ~20 steps with real waits far exceeds Playwright's 30s default.
    test.setTimeout(60_000);
    const lead = quizLead("completion");

    // Act: drive the variable middle to the end while watching the two outcome requests.
    const outcome = await helpers.captureQuizOutcome(() =>
      webClient.quizPage.runToCompletion(lead),
    );

    // Invariant: the flow terminated at the success surface (the path is attached for triage).
    expect(
      outcome.runResult.reachedEnd,
      `reached the end? path: ${outcome.runResult.path.join(" → ")}`,
    ).toBeTruthy();

    // Outcome oracle (variant-independent) — the money result actually happened.
    expect(outcome.accountCreated, "account created (POST /api/v1/users 2xx)").toBeTruthy();
    expect(outcome.trialBooked, "trial booked (POST /api/v1/lessons 2xx)").toBeTruthy();
  });
});
