/**
 * Types for the light QuizFlow engine. The engine is CONTENT-AGNOSTIC: it classifies a step by
 * the SHAPE of its controls (role/kind), never by its copy — so it survives A/B variant flips.
 */

/** What kind of step is on screen, judged by control shape (NOT by wording). */
export type StepKind =
  | "single-choice"
  | "multi-choice"
  | "text"
  | "date"
  | "info"
  | "unknown";

/** Observable result the test asserts on after driving the flow to completion. */
export interface QuizRunResult {
  /** Reached the terminal success/booking surface within the step cap. */
  reachedEnd: boolean;
  /** How many steps were advanced through (for the informational drift snapshot). */
  stepsTaken: number;
  /** The path taken as step kinds, in order (drift snapshot — never asserted as a contract). */
  path: StepKind[];
}
