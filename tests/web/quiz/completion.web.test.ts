import { test, expect } from "@lib/fixtures";
import { AppRoute } from "@pages/allright-app";
import { quizLead } from "@data/quiz/quiz-lead.data";

/**
 * Part B — Variant 1: a resilient business-outcome check.
 *
 * Drives WHATEVER A/B variant is served to completion (generic, shape-based engine — no per-step
 * script) and asserts the variant-independent business result in two halves:
 *   1. TRIAL REQUEST submitted — reached the `/app/request-gotten` confirmation surface (in the live
 *      variant the trial is a request an admin schedules later; there is NO booking POST to watch).
 *   2. ACCOUNT CREATED — `POST /api/v1/users` returned 2xx (read from the network, no API creds).
 *
 * @mutating — a green run creates real entities on stage (a user + a trial request). This is a
 * CI / scheduled-monitor test with synthetic tagged leads, NOT a casual local run.
 */
test.describe("Charlie quiz — completion @web @quiz @completion @mutating", () => {
  test.beforeEach(async ({ webClient }) => {
    await webClient.goTo(AppRoute.quizEntry);
  });

  test.only("QZ-002: completing the quiz creates the account and submits a trial request @web @quiz @completion @mutating", async ({
    webClient,
    helpers,
  }) => {
    // Completing ~21 steps of a live funnel (real waits, transitions, interstitials) far exceeds
    // Playwright's 30s default — give it a realistic budget.
    test.setTimeout(60_000);
    const lead = quizLead("completion");

    // Act: drive the variable middle to the end while watching the account-create request.
    const outcome = await helpers.captureQuizOutcome(() =>
      webClient.quizPage.runToCompletion(lead),
    );

    // Outcome, half 1 — TRIAL REQUEST submitted: the flow terminated on the confirmation surface
    // (`/app/request-gotten`). In this variant the trial is a request an admin schedules later, so the
    // confirmation surface — not a booking POST — is its variant-independent proof. Path attached for triage.
    expect(
      outcome.runResult.reachedEnd,
      `reached the confirmation surface? path: ${outcome.runResult.path.join(" → ")}`,
    ).toBeTruthy();

    // Outcome, half 2 — ACCOUNT CREATED: the money mutation actually hit the backend.
    expect(outcome.accountCreated, "account created (POST /api/v1/users 2xx)").toBeTruthy();
  });
});
