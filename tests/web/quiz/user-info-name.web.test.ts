import { test, expect } from "@lib/fixtures";
import { AppRoute } from "@pages/allright-app";
import { quizLead } from "@data/quiz/quiz-lead.data";

/**
 * Focused regression for the `user-info-name` step.
 *
 * WHY this exists: advancing this step fires a REQUIRED "who's filling this?" picker — a native
 * <dialog class="ui-modal"> that lands ON TOP of the primary CTA. The generic engine must intercept
 * it (pick the PARENT option, which is itself the advance affordance) instead of re-clicking the
 * now-covered CTA and hanging on actionability until timeout. This test pins that interception in
 * isolation, so a regression here fails fast and locally instead of only inside a full completion run.
 *
 * NON-mutating: it deep-links straight to the step and advances ONE step forward — it does NOT run to
 * completion, so no account is created and no trial is booked. Safe to run anywhere.
 */
test.describe("Charlie quiz — user-info-name dialog @web @quiz @dialog", () => {
  test.beforeEach(async ({ webClient }) => {
    await webClient.goTo(AppRoute.userInfoName);
  });

  test("QZ-003: the required 'who's filling this?' picker is intercepted and progress advances @web @quiz @dialog", async ({
    webClient,
  }) => {
    // A live deep-link + a dialog round-trip can exceed Playwright's 30s default; give it headroom.
    test.setTimeout(45_000);
    const quiz = webClient.quizPage;
    const lead = quizLead("userinfo");

    // Precondition: the deep-linked step rendered as itself, and the engine classifies it by shape.
    expect(await quiz.currentStepName()).toBe("user-info-name");
    expect(await quiz.detectStep()).toBe("text");

    // Act: answer + advance. Advancing pops the "who's filling this?" picker on top of the CTA —
    // the engine must dismiss it (pick the parent option) rather than hang on the covered button.
    await quiz.answerCurrentStep(lead);
    await quiz.advance();

    // Invariant (variant-independent): the overlay was handled with no hang, and progress moved
    // FORWARD off user-info-name. We assert the step CHANGED, never which specific step comes next.
    expect(await quiz.currentStepName()).not.toBe("user-info-name");
  });
});
