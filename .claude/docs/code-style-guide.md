# Authoring guide — POM, fixtures, SOLID (deep dive)

The short rules live in `CLAUDE.md`. This is the detail the code skills
(`/analyze-page`, `/sdk-builder`, `/test-write`, `/analyze-test`) pull in when writing or reviewing code.

## The dynamic-quiz principle (read first — it drives every choice below)
The quiz changes weekly and runs multiple A/B variants at once. So the framework is built to assert
**invariants + the business outcome**, and to **navigate the variable middle generically** — never to
script named step N. Concretely:
- **A LIGHT POM.** Model the quiz as ONE `QuizFlow` object with **generic step-handling methods**, not a
  method per named step. Steps are data the methods read at runtime, not code you hand-write per screen.
- **The oracle is variant-independent.** The outcome (account created + trial booked) is the same across
  variants — that's what tests assert. Step content is the "don't fix" tier.

## Layers (single responsibility)
- **Test** (`tests/web/<area>/*.web.test.ts`) — *what* is verified. Arrange → act via POM → **assert with
  `expect`**. No selectors, no flows, no waits-as-logic in the test.
- **Page Object** (`lib/pages/*.page.ts`) — *how* to act. Owns selectors and flows. For the quiz this is the
  generic engine (`runToCompletion`, `answerCurrentStep`, `advance`, `isComplete`). Methods **act and
  return**; they never assert. Every public method is `@step()` so it appears in the report.
- **Data** (`lib/data/…`) — *what data*. Faker factories (`quizLead(prefix)`) and known fixtures. No page logic.
- **API** (`lib/api/…`) — API clients: the **outcome oracle** (verify user + booking) and any setup/teardown,
  behind the `apiClient` fixture.
- **Helpers** (`lib/helpers/…`) — generic, page-agnostic utilities only.

## Page object vs component object
- **Page object** (`*.page.ts`) — models ONE route/screen; owns its selectors + flows. It **composes the
  component objects it renders** by extending their mixins (e.g. `class QuizPage extends ProgressBarMixin(BasePage)`
  gives it `this.progress`). One URL = one page object.
- **Component object** (`components/*.component.ts`) — a **reusable UI region that appears on ≥2 pages** (a
  progress indicator, a shared "continue" bar, a consent banner). It's a `class XComponent extends BasePage`
  (private locators + `@step` methods) **plus** an `XMixin(Base)` that injects it as a property. Page-agnostic
  — no route, identifiers passed in — so every page reuses the **one** class.
- **Composition (the part that matters):** a component **mixes into the PAGES that render it, NOT into
  `WebClient`.** `WebClient` composes **page mixins only** → `webClient.quizPage`. Reach a component **through
  its page**: **`webClient.quizPage.progress.getPercent()`** — never `webClient.progress`.
- **Rule:** bound to one route → **page object**; appears across pages → **component object**. Both extend
  `BasePage`, keep locators private, methods act-and-return + `@step`. A component has **no route**.

## Fixtures (`lib/fixtures.ts`)
Import in every test: `import { test, expect } from "@lib/fixtures";`
- `webClient` — the app. **Page** mixins composed in `lib/pages/allright-app.ts`. Exposes `.quizPage`,
  `.goTo(route)`, `.page`. Components are reached **through their page** — `webClient.quizPage.<component>`.
- `apiClient` — the outcome oracle (query created user + booking) and setup. **No login token needed** — the
  quiz has no auth; oracle creds (if any) come from config, never typed into the UI.
- `helpers` — generic utils.

## SOLID, applied to this suite
- **Single responsibility:** a POM method does one thing; a test verifies one behaviour.
- **Open/closed:** extend by adding POM methods / a new object — don't bloat existing methods with flags.
- **Liskov / interface:** `is…()`/`get…()` consistently return the value the test asserts on; keep that contract.
- **DRY:** reuse existing POM flows and `quizLead()`; never copy a selector into a test.
- **A new page** = a `*.page.ts` extending `BasePage` (+ the component mixins it renders) + a page mixin in
  `mixins.ts` wired into `WebClient`; add its route to `AppRoute` if known.
- **A new component** = a `components/*.component.ts` (the class **+** its `XMixin`); wire `XMixin` into the
  **pages** that render it, **not** into `WebClient`; no route.

## Selectors — derive from the accessibility tree, assume NO framework
The quiz's tech stack is not ours to assume, and it changes. So:
- Prefer **user-facing, resilient** locators (`getByRole`/`getByLabel`/`getByText`) derived from the real
  accessibility tree — see `playwright-guide.md` for the priority ladder.
- **`getByTestId`** if the app exposes stable test ids — the ideal anchor for the entry, the primary "advance"
  control, and the success/outcome surface (the contract-level handles).
- **CSS** only for structure the above can't address; prefer **stable** attributes; never raw hashed/auto-
  generated classes (they change between builds and between A/B variants) and never positional chains.
- For the generic step engine, locators are **role/shape-based, not content-based**: "the primary submit/
  continue control on this step", "the selectable options in this step", "the free-text input", etc. — so
  they resolve on *any* variant. Anchoring on specific option text is a variant coupling and is banned.
- `webClient.waitForTimeout(n)` is in **seconds**. Prefer real waits (`waitFor`, response waits) over sleeps.

## The generic step engine — shape it act-and-return
The heart of the SDK. Rough contract (names illustrative — build to the real page in `/sdk-builder`):
```ts
type StepKind = "single-choice" | "multi-choice" | "text" | "date" | "info" | "unknown";

// read-only: classify the current step from its controls (role/shape, NOT copy)
@step() async detectStep(): Promise<StepKind> { /* … */ }

// act: choose a VALID answer for whatever step is on screen, using the persona for constrained inputs
@step() async answerCurrentStep(persona: QuizLead): Promise<void> { /* … */ }

// act: click the single primary advance affordance; wait for the step to actually change
@step() async advance(): Promise<void> { /* … */ }

// read-only: has the flow reached the terminal success/booking surface?
@step() async isComplete(): Promise<boolean> { /* … */ }

// flow: loop answer→advance until complete or a bounded step cap; returns an observable for the test
@step() async runToCompletion(persona: QuizLead): Promise<QuizRunResult> { /* … */ }
```
`runToCompletion` must be **bounded** (a max-step cap) so a broken/looping variant fails loudly instead of
hanging, and it should record the path it took (step kinds, count) for the informational drift snapshot.

## Example shape
```ts
import { test, expect } from "@lib/fixtures";
import { quizLead } from "@data/quiz/quiz-lead.data";

test.describe("Charlie quiz — completion @web @quiz @completion @mutating", () => {
  test.beforeEach(async ({ webClient }) => {
    await webClient.goTo("/uk/app/sign-up/long/charlie/age-range");
  });

  test("QZ-001: completing the quiz creates the account and books a trial @web @quiz @completion @smoke @mutating", async ({
    webClient,
    apiClient,
  }) => {
    const quiz = webClient.quizPage;
    const lead = quizLead("completion");      // unique tagged synthetic lead (C)

    const run = await quiz.runToCompletion(lead);   // generic drive — no per-step script
    expect(run.reachedEnd).toBeTruthy();             // invariant: the flow terminated at success

    // outcome oracle — variant-independent, the money assertion
    expect(await apiClient.userExists(lead.email)).toBeTruthy();
    expect(await apiClient.trialBookedFor(lead.email)).toBeTruthy();
  });
});
```

## What NOT to do (anti-patterns specific to this quiz)
- **A method per named step** (`answerAgeRange`, `answerGoal`, …) — dies on the next A/B flip. Generic engine only.
- **Asserting step copy / option labels / step count** — the "don't fix" tier; guaranteed false failures.
- **Locators anchored on option text** — `getByText("18-25")` breaks across variants; anchor on role/shape.
- **Re-running the full completion to "verify"** — it creates another real entity; use the API oracle instead.
