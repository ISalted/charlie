---
name: test-write
description: Author a new Playwright automated test for the Charlie quiz AQA suite from a /test-design checklist item or a described scenario — write a THIN test that CONSUMES the SDK in lib/ via the webClient fixture, give it a MEANINGFUL outcome oracle, verify it green on CI, and open a PR for QA-lead review. Use whenever asked to write, add, create, or automate a test / cover a scenario / turn a checklist case into a test. This is the FINALE: /test-design → /analyze-page → /sdk-builder → /test-write.
model: claude-sonnet-4-6
effort: low
---

# /test-write — write the test, prove it, open the PR

The TEST layer and finale of the pipeline. You **consume** the SDK and **judge** the behaviour;
you write `tests/web/<area>/*.web.test.ts` and **never edit `lib/`** (the SDK). Apply `CLAUDE.md`
and the shared docs, don't restate them: `.claude/docs/code-style-guide.md` (thin tests,
expect-in-test, fixtures, tags), `.claude/docs/reporting-guide.md` (Playwright-native results;
`<FOC>-NNN` title IS the id), `.claude/docs/git-ci-guide.md` (branch/PR + MR standards + `workflow_dispatch`).

## The 6 non-negotiables (house rules)
1. **FIXTURES ONLY.** `import { test, expect } from "@lib/fixtures";` Act through `webClient` /
   `apiClient` / `helpers`. The **raw Playwright `page` is NEVER touched** — no `page.*`, and **no
   reaching through `webClient.page`**. A capability that doesn't exist yet → add it in
   `/sdk-builder`, never inline it.
2. **READABLE.** A teammate reads the test as a spec: linear **Arrange → Act → Assert**,
   intent-named POM calls, no cleverness. If a comment is needed to follow the flow, the flow is wrong.
3. **`expect` ALWAYS in the test, NEVER in an SDK method.** SDK methods *act and return*; the test
   judges. Hiding `expect` in `lib/` makes a failure unreadable.
4. **≤ ONE `describe` per file.** Multiple tests of the **same feature** are siblings inside that
   one `test.describe`; a genuinely **new feature** gets a new file + new describe. (file == feature == the `@<feature>` tag, e.g. `@completion`.)
5. **NUMBERING = the checklist id.** `<FOC>-NNN` — three logical, related letters + `00N` — taken
   **VERBATIM** from the `/test-design` checklist at `test-design/<area>/CHECKLIST.md` as the title prefix.
   Never renumber, never invent. There is **no `@T`/`@S`** and no reporter that writes ids back — the
   `<FOC>-NNN` in the title *is* the id.
6. **ASSERT INVARIANTS + OUTCOME, NEVER A/B-VARIABLE CONTENT.** The quiz runs several A/B variants at
   once. A test that asserts **exact copy, an option label, the step order/count, or which variant was
   served** is **wrong by design** — a perpetual false failure. Assert only what's true in *every*
   variant: the **invariants** (the flow terminated, progressed, no dead-ends/console errors) and the
   **business OUTCOME** (account created + trial booked). Variant content is the "don't fix" tier.

## Layer boundary (route out — never patch `lib/`)
This is the **single** rule for missing pieces (referenced by letter below):
- Missing **method** → STOP, `/sdk-builder`. Missing **locator** → STOP, `/analyze-page`.
- A selector (`getByRole`/`getByTestId`), a Playwright **action**, or a `waitFor`-as-logic appearing in
  a test means the SDK is **incomplete** → route it out, never inline. **Never edit `lib/` here.**

## The quality bar (A–H) — acceptance criteria for "done"
- **A. MEANINGFUL OUTCOME ORACLE (mutation-check).** *"If the funnel were silently broken, would this
  still pass?"* If yes → too weak. The oracle for the quiz is the **business OUTCOME — account created +
  trial booked** — asserted via `apiClient` (query the created user + booking) or a network-response
  intercept (the create/booking request(s) returned 2xx), **not "a screen appeared"**. A test that only
  checks `isComplete()` or that a success screen rendered, **without the outcome oracle**, is too weak —
  a broken funnel that still paints a confirmation screen would pass it. Assert the reached-end
  **invariant** *and* the outcome.
- **B. ONE BEHAVIOUR PER TEST.** Verify ONE thing end-to-end; assert **all facets that define it**
  (completed → the flow reached the end AND the account exists AND the trial is booked), nothing extra.
- **C. ISOLATION + UNIQUE DATA — NO login, NO session.** Each test self-seeds a unique **tagged
  synthetic lead** via `quizLead(prefix)` and depends on no other test's state or order. **Auth is
  inverted: there is no login, no password to type, no session to reuse** — the identity is *produced by*
  completing the quiz, not a precondition. CI runs a **single worker** today, but isolation keeps tests
  rerun-safe and **parallel-ready** for when workers grow — never rely on execution order or shared state.
- **D. NEGATIVES / GUARD CASES PIN THE SPECIFIC INVARIANT.** If a case checks a guard (a step that must
  not dead-end, an advance that must move progress forward), assert the exact invariant — progress
  increased, the step changed, no failed 4xx/5xx — **AND** that the run didn't silently "complete"
  without the outcome. Never "it broke somehow".
- **E. NO LOGIC.** No `if/else`, no loops **in the test** that change what's asserted — one linear path,
  so a failure points to one place. (The variable-middle looping lives inside the SDK's `runToCompletion`,
  not the test.)
- **F. NO RAW-PAGE SELECTORS/ACTIONS.** A `page.*`/`webClient.page` call, a `getByRole`/`getByTestId`
  used to **act or locate**, or a `waitFor`-as-logic inside a test = the SDK is incomplete → route out
  (see Layer boundary). Prefer an SDK read-back getter over any sleep; `webClient.waitForTimeout(n)` is
  **seconds**.
- **G. VERIFY GREEN ON CI** before "done" — see Process §5.
- **H. TITLE + TAGS + ID** — see Process §3.

## Process

### 1. Take the case
- Input is one `/test-design` line — `- [ ] <FOC>-NNN: <behaviour> (priority)` — or a scenario.
  **Restate the observable behaviour in one line**, as an invariant/outcome, never as variant content.
- Pick the area (`quiz`, … — check `tests/web/`) and the SDK object: `webClient.quizPage` (the light
  `QuizFlow` engine), `apiClient` (the outcome oracle). Read the area's existing tests + the object's
  public method names — reuse what exists.

### 2. Map case → SDK methods (confirm before writing)
- List the **act** + **read-back** methods the case needs; confirm each exists on the object. Missing →
  route out (Layer boundary). The generic engine (`runToCompletion` → a `QuizRunResult`, `isComplete`)
  plus the oracle getters (`apiClient.userExists`, `apiClient.trialBookedFor`) are what make a real
  outcome oracle (A) possible — if one is missing, that's an SDK gap, not a test.
- **Preconditions:** there are none to log in — the flow *produces* the identity. Any pre/post-check of
  the created entity goes through **`apiClient`** (cheapest, variant-independent), never by re-driving
  the UI. Don't re-run the full completion to "check" — it creates another real entity (guardrails).

### 3. Write the thin test
File `tests/web/<area>/<feature>.web.test.ts` — extend the feature's existing file if it fits.
- One `describe` (rule 4); `beforeEach` navigates only to the **entry route**; body is **Arrange → Act →
  Assert** (B, E).
- **Title** (H): `<FOC>-NNN: <behaviour>`; **tags** on both `describe` and test:
  `@web @<area> @<feature>` (+ `@mutating` — completion writes real data; + `@smoke` if it's the
  critical funnel check per `/test-design`).
- **ID** (H): the `<FOC>-NNN` prefix **is** the id — verbatim from the checklist. **No `@T`/`@S`, no
  external ids, no sync step** — Playwright-native reporting reads the id straight off the title.
- **Unique data** (C): one `quizLead(prefix)` per test.

```ts
import { test, expect } from "@lib/fixtures";
import { quizLead } from "@data/quiz/quiz-lead.data";

test.describe("Charlie quiz — completion @web @quiz @completion @mutating", () => {
  test.beforeEach(async ({ webClient }) => {
    await webClient.goTo("/uk/app/sign-up/long/charlie/age-range"); // entry only
  });

  test("QZ-001: completing the quiz creates the account and books a trial @web @quiz @completion @smoke @mutating", async ({
    webClient,
    apiClient,
  }) => {
    const quiz = webClient.quizPage;
    const lead = quizLead("completion"); // unique tagged synthetic lead → order-independent (C)

    // Act — drive the variable middle generically; no per-step script, no content assertions
    const run = await quiz.runToCompletion(lead);

    // Assert — invariant: the flow actually terminated at the success surface (E: no logic in the test)
    expect(run.reachedEnd).toBeTruthy();

    // Outcome oracle — variant-independent, the money assertion (A, B).
    // If the funnel were silently broken, these fail even if a screen still painted.
    expect(await apiClient.userExists(lead.email)).toBeTruthy();
    expect(await apiClient.trialBookedFor(lead.email)).toBeTruthy();
  });
});
```
*(`QZ-001` and the method names are the shape modelled in `code-style-guide.md` — use the real
`<FOC>-NNN` from `/test-design` and the real `quizPage`/`apiClient` methods. No `@S`/`@T` anywhere.)*

### 4. Safe data (guardrails)
- Mutating completion tests use `quizLead(prefix)` **throwaway tagged synthetic leads ONLY** — never real
  or shared identities. Keep runs minimal/rate-limited so you don't pollute product analytics.
- **NEVER solve or bypass CAPTCHA / bot-detection** — if the flow hits one, stop and flag it.
- **NEVER enter real payment, card, or credential data** — if completion needs it, request a stage
  test-hook from the Charlie team. Prefer the **`apiClient` oracle** over re-running the flow to re-check.

### 5. Verify it works (bar G — don't finalize on a guess)
- `npx tsc --noEmit` → fix type errors.
- **Branch, commit, push — then run on CI and confirm GREEN** before the PR: branch `aqa/<short-desc>`
  off `main`, conventional commit (`test: <FOC>-NNN <behaviour>`), push. Then `workflow_dispatch` on
  `aqa.yml` **on that branch** (via `gh` / the **github** MCP), `grep` = the **full** `<FOC>-NNN`
  (substring match — the full id, so `QZ-01` doesn't sweep `QZ-010..019`). Don't run mutating completion
  flows locally.
- **GREEN is now the honest job result** — there is **no `continue-on-error` masking**, so the GitHub
  Actions **job conclusion** *is* the real pass/fail. Read it via `gh run view <id>` and confirm against
  the **Playwright HTML report** (`gh run download <id> -n playwright-report` → `npx playwright
  show-report`). Note: with `retries` > 0 a test that fails-then-passes is reported **`flaky`** — flaky
  is **not** green; triage it (see `reporting-guide.md` / `/analyze-report`).
- A single green run is weak evidence for a slow/async completion flow: for the funnel test, re-run once
  or check the test's cross-run history before "done".
- **RED → diagnose by cause:** test bug (assertion/data/method use) → fix **here**, re-run; missing/wrong
  method → `/sdk-builder`; missing/wrong locator → `/analyze-page`. Never patch `lib/`.

### 6. Land it — open the PR (bar H, the review gate)
The PR finale stays here for a single new test. The branch is **already pushed and green** (§5). Apply
the **MR standards** in `git-ci-guide`:
- Open the PR `aqa/<short-desc>` → **`main`**. **PR title** `test: <FOC>-NNN <behaviour>`.
- **Body**: what it covers · the `<FOC>` id · link to the checklist item / requirement · the **green
  CI-run link** · "for QA-lead review — do not merge".
- **SDK + test together:** a new test **plus the SDK it needs** (locators/methods just added) land as
  **one** test-write PR; SDK with no immediate test goes via `/open-pr`.
- **Never push to `main`. Never merge.** For **non-test or batch** change-sets, that's **`/open-pr`** —
  don't double-PR the same change.

### 7. Report + offer next
Return the **PR url**, the `<FOC>` id, the **green-run link**, and a **2-line** oracle summary:
(1) the observable outcome the test proves (account created + trial booked), (2) why it would fail if the
funnel were silently broken. Then **offer the next step** via `AskUserQuestion` (CLAUDE.md Interaction
model), don't auto-proceed:
*[▶ automate the next checklist case] [🔁 re-run on CI via `/run`] [⏸ stop — awaiting QA-lead review]*.
