# Playwright MCP guide — analysing the quiz & building robust locators/POM

Shared knowledge pulled in by `/analyze-page`, `/sdk-builder` and `/test-write`. The **playwright** MCP drives a
**real browser locally** — for **studying the quiz, deriving robust locators, and building/extending the light
`QuizFlow` POM**, NOT the official run (that's CI → `git-ci-guide.md`). Garbage selectors → garbage tests, so
this is the most precision-sensitive work we do: derive from reality, verify, never guess.

## App access & auth
- BASE_URL (stage): `https://stage.allright.com`; quiz entry `/uk/app/sign-up/long/charlie/age-range`.
- **No auth.** The quiz is public — there is no login, no session to reuse, no password. The account is
  *created by* completing the flow, not a precondition.
- Stage may be slow on first navigation; wait, don't thrash.

## ⚠️ Read-only vs mutation (the guardrail that matters here)
Analysing is **read-only**: navigate, snapshot, hover, read the DOM, step **backward/forward** through screens
without submitting the final booking. **Completing the quiz is a REAL mutation** — it creates a user + trial on
live stage. During analysis, study the step anatomy without finishing the funnel; only complete it when a test
intentionally does so (and never solve a CAPTCHA / enter payment).

## Reliable extraction via MCP (avoid the flailing / wasted-selector trap)
A disciplined loop — do it once, correctly, instead of guessing and re-running:
1. `browser_navigate` to the quiz entry.
2. `browser_snapshot` → the **accessibility tree** (roles + accessible names). This is the SOURCE of truth and
   maps **directly** to Playwright's `getByRole`/`getByText`/`getByLabel` — derive locators from it, don't invent CSS.
3. For anything the a11y tree doesn't expose (custom widgets, hashed classes), use `browser_evaluate` to read the
   real DOM/attributes precisely — never assume a class name. Check for **`data-testid`/`data-*`** hooks first.
4. **VERIFY every candidate locator resolves to EXACTLY ONE element** (Playwright strict mode). If it matches 0
   or >1, scope it (`.locator(container).getBy…`, `.filter({ hasText })`, `.first()` only with reason).
5. Only commit a locator once verified. Snapshot → derive → verify → record. No loops of trial-and-error.

## Locator philosophy — Playwright best practices (priority order)
Prefer **user-facing, resilient** locators; fall back only when forced. Top to bottom:
1. **`getByRole(role, { name })`** — primary. Resilient to DOM/CSS churn (button, radio, checkbox, textbox,
   heading…). Use the accessible name from the snapshot.
2. **`getByLabel`** (form fields), **`getByPlaceholder`**, **`getByText`**, **`getByAltText`**, **`getByTitle`**.
3. **`getByTestId`** — if the app exposes test ids. The **preferred anchor for contract-level handles** (entry,
   the primary advance control, the outcome/success surface) because they survive A/B copy changes.
4. **CSS** — only for structure the above can't address; prefer **stable** attributes; scope tightly.
5. **XPath** — last resort; **never absolute XPath**, never `nth-child` position chains.
- **Banned:** position-based (`nth-child`), long brittle descendant chains, raw auto-generated/hashed classes
  (they change between builds *and* between A/B variants), and — specific to this quiz — **localized/volatile
  option text as the sole anchor**.

## Content-agnostic locators — the A/B rule (specific to this quiz)
Because steps, texts, and options differ per variant and per week, locators for the generic engine must key on
**role/shape/structure, not content**:
- "the primary advance control on the current step" → the single enabled submit/continue button by role, scoped
  to the active step container — **not** `getByRole("button", { name: "Continue" })` (copy is variant/locale-bound).
- "the selectable options of the current step" → a **factory** returning the option controls by role
  (`radio`/`checkbox`/option-role), verified on a real sample — **not** matched by option label.
- "the free-text input", "the date input" → by role/type, scoped to the active step.
- Contract-level, stable screens (entry, success/booking) MAY use a `getByTestId`/role handle keyed on a stable
  attribute — these don't move between variants. Everything in the variable middle stays content-agnostic.

## Page Object encapsulation (how locators become a POM)
- **Locators are PRIVATE fields** on the object. **Tests never touch selectors — only call methods.**
- **Public methods are intent-named verbs/getters**, each `@step()`, that *act and return* (`advance()`,
  `detectStep(): StepKind`, `isComplete(): boolean`). Assertions stay in the test.
- **Concise names:** private locators are descriptive nouns (`private advanceBtn`, `private stepContainer`,
  `private options`); methods read as intent, not mechanics.
- **Parameterized/repeated elements → a private locator factory** verified on a REAL sample, e.g.
  `private optionAt = (i: number) => this.stepContainer.getByRole("radio").nth(i);` (shape-based, not text-based).
- Match the existing `lib/pages/*.page.ts` structure and the rules in `code-style-guide.md`.

## Boundary
The MCP browser runs **locally** and is single-client — for analysis/authoring only. The actual pass/fail run
goes to GitHub Actions via `aqa.yml` (`/run`), reported through Playwright's HTML report + traces.
