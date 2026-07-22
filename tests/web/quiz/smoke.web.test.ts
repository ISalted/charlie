import { test, expect } from "@lib/fixtures";
import { AppRoute } from "@pages/allright-app";

/**
 * Smoke: the cheapest funnel-health check — the quiz entry loads and the GENERIC engine
 * recognises the first step on whatever A/B variant is served. NON-mutating (no completion,
 * no account created), so it is safe to run anywhere. The full completion + outcome-oracle
 * check lives in completion.web.test.ts (@mutating).
 */
test.describe("Charlie quiz — smoke @web @quiz @smoke", () => {
  test.beforeEach(async ({ webClient }) => {
    await webClient.goTo(AppRoute.quizEntry);
  });

  test("QZ-001: the quiz entry loads on a recognisable first step @web @quiz @smoke", async ({
    webClient,
  }) => {
    const quiz = webClient.quizPage;

    // Invariant: we are at the start of the funnel, not already past it.
    expect(await quiz.isComplete()).toBeFalsy();

    // Invariant: the entry renders a step the content-agnostic engine can classify (any variant).
    const kind = await quiz.detectStep();
    expect(["single-choice", "multi-choice", "text", "date", "info"]).toContain(kind);

    // Invariant: the progress counter is present and reads the FIRST step ("1 / N").
    const progress = await quiz.progressText();
    expect(progress).toMatch(/^1\s*\/\s*\d+$/);
  });
});
