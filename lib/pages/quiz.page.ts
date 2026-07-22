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
  // (single-choice, multi-choice, info, text, phone/email) + the overlay dialogs.
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
  private readonly stepContainer: Locator = this.page
    .locator("[data-step-name]")
    .last();

  /** Step counter "N / M" — drives the "progress moves forward" invariant. */
  private readonly stepCounter: Locator = this.page.locator(
    '[class*="step-counter"]',
  );

  /** Header back control (icon-only). Keyed on the arrow svg symbol (namespaced xlink:href). */
  private readonly backButton: Locator = this.page.locator(
    'button:has(use[*|href="#long-arrow-left"])',
  );

  // ── Generic step anatomy (content-agnostic, scoped to the active step) ──

  /** The single primary advance CTA (info / multi-choice / input steps). Absent on single-choice. */
  private readonly primaryCta: Locator =
    this.stepContainer.locator("button.btn.orange");

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
  private readonly optionAt = (index: number): Locator =>
    this.optionButtons.nth(index);

  // ── Overlay dialogs (interstitial modals that interrupt the flow) ──

  /** The random "leaving-page" exit-intent popup: a native `<dialog class="popup-leaving-page">` in the
   *  TOP LAYER that fires at ANY step and unmounts the step behind it. Verified live: clicking its CTA
   *  span (`.popup-leaving-page__btn`) closes it and remounts the step — it does NOT actually book. */
  private readonly leavingPopup: Locator = this.page.locator(
    "dialog.popup-leaving-page[open]",
  );
  private readonly leavingPopupDismiss: Locator = this.leavingPopup.locator(
    ".popup-leaving-page__btn",
  );

  /** A blocking modal other than the leaving-page popup — e.g. the required "who's filling this?"
   *  picker, which is a native `<dialog>` (no role attribute), so match `dialog[open]` too. Filtered to
   *  VISIBLE so `.isVisible()` never trips strict-mode on hidden duplicate modals. Leaving-page popup is
   *  excluded (handled by its own branch first). */
  private readonly dialog: Locator = this.page.locator(
    'dialog[open]:not(.popup-leaving-page), [role="dialog"]',
  );

  /** The visible dialog's ✕ close control (accessible name "Close"). */
  private readonly dialogClose: Locator = this.dialog
    .first()
    .getByRole("button", { name: "Close" });

  /** The visible dialog's answer buttons (labelled) — present on a REQUIRED picker. Content-agnostic. */
  private readonly dialogChoiceButtons: Locator = this.dialog
    .first()
    .locator("button")
    .filter({ hasText: /\S/ });

  // ── Success / outcome surface ──
  // The quiz has NO confirmation-screen test-id. Completing the funnel REDIRECTS to the trial-request
  // confirmation page `/uk/app/request-gotten` ("Дякуємо! Ваш запит отримано") — verified live from a
  // real completion trace. (`/app/dashboard` is kept as a known alternate success surface in case a
  // variant logs the user straight in.) `isComplete()` keys on this URL — the stable, copy-independent
  // signal. The account-created proof is the OUTCOME ORACLE (POST /api/v1/users), read from the
  // network, not this surface.

  /** URL of a terminal success surface — the trial-request confirmation, or the dashboard (alternate
   *  variant). Copy-independent; this is what `isComplete()` keys on. */
  private static readonly SUCCESS_URL = /\/app\/(request-gotten|dashboard)/;

  // ════════════════════════════════════════════════════════════════════════
  // ── METHODS — the generic step engine (act-and-return; the object never asserts) ──
  // ════════════════════════════════════════════════════════════════════════

  /** Classify the current step by CONTROL SHAPE (never by copy) → a typed StepKind. */
  @step()
  async detectStep(): Promise<StepKind> {
    await this.stepContainer.waitFor({ state: "visible" }).catch(() => {});
    if (
      await this.textInput
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      const type = await this.textInput
        .first()
        .getAttribute("type")
        .catch(() => null);
      return type === "date" ? "date" : "text";
    }
    if ((await this.optionButtons.count().catch(() => 0)) > 0) {
      return (await this.primaryCta.isVisible().catch(() => false))
        ? "multi-choice"
        : "single-choice";
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

  /**
   * Clear a blocking overlay if one is open. Order:
   *  1. the "leaving-page" exit-intent popup (native <dialog>, top layer) → click its CTA span with
   *     force:true (the top-layer hit-test defeats a normal click); Escape is a fallback;
   *  2. a role-based picker dialog → pick its first labelled option;
   *  3. any other role dialog → close it.
   * Locator-only — no page.evaluate (that throws "Target closed" during a step transition).
   * Safe to call before every action; a no-op when nothing is open.
   */
  @step()
  async handleDialogIfPresent(): Promise<void> {
    if ((await this.leavingPopup.count().catch(() => 0)) > 0) {
      await this.leavingPopupDismiss
        .click({ force: true, timeout: 5000 })
        .catch(() => {});
      if ((await this.leavingPopup.count().catch(() => 0)) > 0) {
        await this.page.keyboard.press("Escape").catch(() => {});
      }
      await this.leavingPopup
        .waitFor({ state: "detached", timeout: 5000 })
        .catch(() => {});
      return;
    }
    if ((await this.dialog.count().catch(() => 0)) === 0) return;
    // "Who's filling this?" picker: choose the PARENT option — the child option routes into a
    // different flow that dead-ends the booking. Fall back to the first labelled option / Close.
    const parent = this.dialog
      .first()
      .getByRole("button", { name: /батьк|мати|parent/i });
    if ((await parent.count().catch(() => 0)) > 0) {
      await parent
        .first()
        .click({ force: true })
        .catch(() => {});
    } else if ((await this.dialogChoiceButtons.count().catch(() => 0)) > 0) {
      await this.dialogChoiceButtons
        .first()
        .click({ force: true })
        .catch(() => {});
    } else {
      await this.dialogClose.click({ force: true }).catch(() => {});
    }
    await this.dialog
      .first()
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => {});
  }

  /** Reached the terminal success surface (trial-request confirmation, or dashboard alternate). */
  @step()
  async isComplete(): Promise<boolean> {
    return QuizPage.SUCCESS_URL.test(this.page.url());
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
    let reached = false;

    for (let i = 0; i < QuizPage.MAX_STEPS; i++) {
      await this.handleDialogIfPresent();
      if (await this.isComplete()) {
        reached = true;
        break;
      }
      await this.settleStep(); // let the liquid-fire transition finish before reading/acting

      const before = await this.currentStepId();
      path.push(await this.detectStep());
      stepsTaken += 1;

      await this.answerCurrentStep(persona);
      await this.advanceFrom(before); // clicks the CTA if present; single-choice already advanced
    }

    return {
      reachedEnd: reached || (await this.isComplete()),
      stepsTaken,
      path,
    };
  }

  // ── private helpers (no @step; not part of the test-facing contract) ──

  private async currentStepId(): Promise<string | null> {
    // Short timeout: on the terminal page (request-gotten) there is NO `[data-step-name]`, and an
    // unbounded getAttribute would auto-wait for it until the whole test times out (~26s observed).
    // Absent → null fast; the caller (isComplete / advanceFrom) decides what that means.
    return this.stepContainer
      .getAttribute("data-step-name", { timeout: 3000 })
      .catch(() => null);
  }

  /**
   * Wait for a liquid-fire transition to finish — exactly ONE `[data-step-name]` in the DOM — so we
   * never read/act on the outgoing step that is still animating out. Returns early if an overlay is up
   * (it unmounts the step; handleDialogIfPresent clears it) or we've completed. Uses waitForFunction,
   * NOT page.evaluate, so it never throws "Target closed" during a transition.
   */
  private async settleStep(): Promise<void> {
    await this.page
      .waitForFunction(
        () =>
          /\/app\/(request-gotten|dashboard)/.test(location.pathname) ||
          !!document.querySelector("dialog.popup-leaving-page[open]") ||
          document.querySelectorAll("[data-step-name]").length === 1,
        undefined,
        { timeout: 10000 },
      )
      .catch(() => {});
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
    // Clear any pre-filled value first (the phone field is pre-seeded with the "0" country code —
    // typing the full E.164 on top of it would produce "00…" and never validate).
    await input.fill("").catch(() => {});
    // pressSequentially (not fill): masked/intl inputs only enable their CTA on real key events.
    await input.pressSequentially(value);
  }

  /**
   * Leave the current step. Click its CTA (if any) and wait for the step to change. The leaving-page
   * popup often fires ON this click (esp. on multi-select), intercepting it — so if it appears we
   * DISMISS it and RE-CLICK the CTA (never the answer option: re-clicking a multi-select option would
   * toggle the selection back off). Bounded retries; single-choice that already auto-advanced returns
   * immediately.
   */
  private async advanceFrom(beforeStepId: string | null): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      // Clear ANY overlay that intercepted a previous attempt — the exit-intent leaving popup OR a
      // REQUIRED picker (e.g. the "who's filling this?" native <dialog> that lands ON TOP of the CTA
      // right after clicking it). Without this the loop re-clicks the now-covered CTA and Playwright
      // hangs on actionability until the test times out ("залипає"). Some pickers ARE the advance
      // affordance, so clearing one can itself move the step forward — hence `continue`, to re-read
      // the step id at the loop top before touching the CTA again.
      if (
        (await this.leavingPopup.count().catch(() => 0)) > 0 ||
        (await this.dialog.count().catch(() => 0)) > 0
      ) {
        await this.handleDialogIfPresent();
        await this.settleStep();
        continue;
      }
      if (QuizPage.SUCCESS_URL.test(this.page.url())) return;
      const current = await this.currentStepId();
      if (current !== null && current !== beforeStepId) return; // already advanced

      if (
        (await this.primaryCta.isVisible().catch(() => false)) &&
        (await this.primaryCta.isEnabled().catch(() => false))
      ) {
        await this.primaryCta.click().catch(() => {});
      }
      await this.page
        .waitForFunction(
          (prev: string | null) => {
            if (/\/app\/(request-gotten|dashboard)/.test(location.pathname))
              return true;
            // an overlay intercepted the advance → stop waiting; the loop clears it and we retry.
            if (document.querySelector("dialog[open], [role=dialog]"))
              return true;
            const steps = document.querySelectorAll("[data-step-name]");
            for (let i = 0; i < steps.length; i += 1) {
              if (steps[i].getAttribute("data-step-name") !== prev) return true;
            }
            return false;
          },
          beforeStepId,
          { timeout: 8000 },
        )
        .catch(() => {}); // never throw from the engine; reachedEnd is judged by isComplete()
    }
  }
}
