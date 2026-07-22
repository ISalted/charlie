import type { Locator } from "@playwright/test";
import { BasePage } from "@pages/base.page";
import { step } from "@helpers/step";
import type { QuizLead } from "@data/quiz/quiz-lead.data";
import type { StepKind, QuizRunResult } from "@pages/quiz.types";

/**
 * QuizPage — the LIGHT QuizFlow object for the Charlie sign-up quiz.
 *
 * The quiz is dynamic (multiple concurrent A/B variants), so this object is a GENERIC step
 * engine, NOT one method per named step. Coverage sits on invariants + the business outcome,
 * never on variant content. See .claude/docs/code-style-guide.md.
 */
export class QuizPage extends BasePage {
  /** Safety cap so a broken/looping A/B variant fails loudly instead of hanging. */
  private static readonly MAX_STEPS = 40;

  // ════════════════════════════════════════════════════════════════════════
  // SELECTORS — verified against the live quiz (2026-07-21), sampled across ALL 21 steps
  // (single-choice, multi-choice, info, text, phone/email) + the two overlay dialogs.
  // Ember app, NO data-testid; the ONE stable structural hook is `[data-step-name]`.
  // Middle-of-quiz locators are CONTENT-AGNOSTIC (role/shape scoped to the active step),
  // NEVER anchored on option copy. Step KIND is told apart structurally:
  //   • single-choice → option buttons, NO `.btn.orange` CTA (option click auto-advances)
  //   • multi-choice  → option buttons + a `.btn.orange` CTA
  //   • info          → only a `.btn.orange` CTA, no options, no inputs
  //   • text / date   → a visible <input>/<textarea> + a `.btn.orange` submit CTA
  // `.btn.orange` = the app's design-system primary-CTA class; separates advance from options.
  // ════════════════════════════════════════════════════════════════════════

  // ── Contract-level handles (stable across variants) ──

  /** The active step wrapper — scope root for every content-agnostic child. `.last()` prefers the
   *  incoming step during liquid-fire transitions (two may briefly coexist). */
  private readonly stepContainer: Locator = this.page.locator("[data-step-name]").last();

  /** Step counter "N / M" — drives the "progress moves forward" invariant. */
  private readonly stepCounter: Locator = this.page.locator('[class*="step-counter"]');

  /** Header back control (icon-only). Keyed on the arrow svg symbol (namespaced xlink:href). */
  private readonly backButton: Locator = this.page.locator(
    'button:has(use[*|href="#long-arrow-left"])',
  );

  // ── Generic step anatomy (content-agnostic, scoped to the active step) ──

  /** The single primary advance CTA (info / multi-choice / input steps). Absent on single-choice. */
  private readonly primaryCta: Locator = this.stepContainer.locator("button.btn.orange");

  /** Answer options: step buttons that are NOT the CTA and carry a visible label (excludes the
   *  icon-only "mute video" control that some steps render). Verified 10 (age-range) / 8 (child-hobby). */
  private readonly optionButtons: Locator = this.stepContainer
    .locator("button:not(.btn.orange)")
    .filter({ hasText: /\S/ });

  /** The visible text-like input on input steps (name/phone/email). `:visible` drops the hidden
   *  synced field the intl-tel widget keeps alongside the real one. */
  private readonly textInput: Locator = this.stepContainer.locator(
    "input:visible, textarea:visible",
  );

  /** One answer option by index — shape-based factory (parameterization, not `.first()`-papering). */
  private readonly optionAt = (index: number): Locator => this.optionButtons.nth(index);

  // ── Overlay dialogs (interstitial modals that interrupt the flow) ──

  /** A blocking overlay modal (upsell urgency popup, or the required "who's filling this?" picker). */
  private readonly dialog: Locator = this.page.locator('[role="dialog"]');

  /** The dialog's ✕ close control (accessible name "Close"). Dismisses a pure-upsell overlay. */
  private readonly dialogClose: Locator = this.dialog.getByRole("button", { name: "Close" });

  /** The dialog's answer buttons (labelled) — present on a REQUIRED picker, absent on a pure upsell.
   *  Content-agnostic: any labelled button inside the dialog, never matched by copy. */
  private readonly dialogChoiceButtons: Locator = this.dialog
    .locator("button")
    .filter({ hasText: /\S/ });

  // ── Success / outcome surface ──
  // The quiz has no confirmation-screen test-id; completion REDIRECTS to the authenticated
  // dashboard. `isComplete()` keys on that URL. The variant-independent proof (account created +
  // trial booked) is the OUTCOME ORACLE — verified via the network/API, not this surface.

  // ════════════════════════════════════════════════════════════════════════
  // ── METHODS — the generic step engine (act-and-return; the object never asserts) ──
  // ════════════════════════════════════════════════════════════════════════

  /** Classify the current step by CONTROL SHAPE (never by copy) → a typed StepKind. */
  @step()
  async detectStep(): Promise<StepKind> {
    await this.stepContainer.waitFor({ state: "visible" }).catch(() => {});
    if (await this.textInput.first().isVisible().catch(() => false)) {
      const type = await this.textInput.first().getAttribute("type").catch(() => null);
      return type === "date" ? "date" : "text";
    }
    if ((await this.optionButtons.count().catch(() => 0)) > 0) {
      return (await this.primaryCta.isVisible().catch(() => false)) ? "multi-choice" : "single-choice";
    }
    if (await this.primaryCta.isVisible().catch(() => false)) return "info";
    return "unknown";
  }

  /** Provide a VALID answer for whatever step is on screen, by shape/persona — never by label. */
  @step()
  async answerCurrentStep(persona: QuizLead): Promise<void> {
    switch (await this.detectStep()) {
      case "single-choice":
      case "multi-choice":
        await this.optionAt(0).click();
        break;
      case "text":
      case "date":
        await this.fillTextStep(persona);
        break;
      case "info":
      case "unknown":
        break;
    }
  }

  /** Click the primary advance CTA (if this step has one) and wait for the step to actually change. */
  @step()
  async advance(): Promise<void> {
    await this.advanceFrom(await this.currentStepId());
  }

  /** Dismiss/answer a blocking overlay dialog if one is open (required picker → answer; upsell → close). */
  @step()
  async handleDialogIfPresent(): Promise<void> {
    if (!(await this.dialog.isVisible().catch(() => false))) return;
    if ((await this.dialogChoiceButtons.count().catch(() => 0)) > 0) {
      await this.dialogChoiceButtons.first().click().catch(() => {});
    } else {
      await this.dialogClose.click().catch(() => {});
    }
    await this.dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }

  /** Reached the terminal success surface (authenticated dashboard after booking). */
  @step()
  async isComplete(): Promise<boolean> {
    return this.page.url().includes("/app/dashboard");
  }

  /** Read the current progress counter text ("N / M"), or null if absent. */
  @step()
  async progressText(): Promise<string | null> {
    if (!(await this.stepCounter.isVisible().catch(() => false))) return null;
    return (await this.stepCounter.innerText()).replace(/\s+/g, " ").trim();
  }

  /**
   * Drive the quiz to completion generically: answer whatever step is on screen and advance,
   * bounded by MAX_STEPS. Returns an observable result — the TEST judges pass/fail. Never asserts.
   */
  @step()
  async runToCompletion(persona: QuizLead): Promise<QuizRunResult> {
    const path: StepKind[] = [];
    let stepsTaken = 0;

    for (let i = 0; i < QuizPage.MAX_STEPS; i++) {
      await this.handleDialogIfPresent();
      if (await this.isComplete()) return { reachedEnd: true, stepsTaken, path };

      const before = await this.currentStepId();
      path.push(await this.detectStep());
      stepsTaken += 1;

      await this.answerCurrentStep(persona);
      await this.advanceFrom(before); // clicks the CTA if present; single-choice already advanced
    }

    return { reachedEnd: await this.isComplete(), stepsTaken, path };
  }

  // ── private helpers (no @step; not part of the test-facing contract) ──

  private async currentStepId(): Promise<string | null> {
    return this.stepContainer.getAttribute("data-step-name").catch(() => null);
  }

  /** Fill the visible input with the persona value matching its shape (phone / email / name). */
  private async fillTextStep(persona: QuizLead): Promise<void> {
    const input = this.textInput.first();
    const [type, name, inputmode] = await Promise.all([
      input.getAttribute("type").catch(() => null),
      input.getAttribute("name").catch(() => null),
      input.getAttribute("inputmode").catch(() => null),
    ]);
    let value = persona.firstName;
    if (type === "tel" || inputmode === "tel") value = persona.phone;
    else if (type === "email" || name === "email") value = persona.email;
    await input.click();
    // pressSequentially (not fill): masked/intl inputs only enable their CTA on real key events.
    await input.pressSequentially(value);
  }

  /** Click the CTA if this step has an enabled one, then wait until the step changes or we complete. */
  private async advanceFrom(beforeStepId: string | null): Promise<void> {
    if (
      (await this.primaryCta.isVisible().catch(() => false)) &&
      (await this.primaryCta.isEnabled().catch(() => false))
    ) {
      await this.primaryCta.click().catch(() => {});
    }
    await this.page
      .waitForFunction(
        (prev: string | null) => {
          if (location.pathname.includes("/app/dashboard")) return true;
          const steps = document.querySelectorAll("[data-step-name]");
          for (let i = 0; i < steps.length; i += 1) {
            if (steps[i].getAttribute("data-step-name") !== prev) return true;
          }
          return false;
        },
        beforeStepId,
        { timeout: 20000 },
      )
      .catch(() => {}); // reachedEnd is judged by isComplete(); never throw from the engine
  }
}
