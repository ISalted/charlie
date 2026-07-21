import { BasePage } from "@pages/base.page";

/**
 * QuizPage — the LIGHT QuizFlow object for the Charlie sign-up quiz.
 *
 * The quiz is dynamic (multiple concurrent A/B variants), so this object is modelled as a
 * GENERIC step engine, NOT one method per named step. Coverage sits on invariants + the
 * business outcome, never on variant content. See .claude/docs/code-style-guide.md.
 *
 * This is a SCAFFOLD — the layers below are filled by the skill pipeline:
 *   /analyze-page  → the private, content-agnostic LOCATOR layer (role/shape-based).
 *   /sdk-builder   → the @step act-and-return METHODS (detectStep / answerCurrentStep /
 *                    advance / isComplete / runToCompletion — a bounded loop).
 */
export class QuizPage extends BasePage {
  // ════════════════════════════════════════════════════════════════════════
  // SELECTORS — added by /analyze-page (content-agnostic: role/shape, never option copy).
  // Contract-level handles (entry, primary advance control, success surface) may use test-ids.
  // ════════════════════════════════════════════════════════════════════════

  // ── METHODS — added by /sdk-builder (the generic step engine + outcome hooks) ──
}
