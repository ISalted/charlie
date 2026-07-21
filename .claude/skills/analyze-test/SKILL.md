---
name: analyze-test
description: Explain AND critically assess an existing Charlie AQA test (or a whole file/area) like a senior AQA — what it verifies, how it's written, whether its assertions actually prove the business outcome (account created + trial booked), its real-run reliability/flakiness, code smells, and coverage gaps. Returns a verdict plus prioritized fixes. Use when asked to analyze, explain, review, audit, understand, or onboard someone to a test. Read-only — never modifies code.
model: claude-sonnet-4-6
effort: medium
---

# Analyze a test

Read-only counterpart of `/analyze-report`: that one judges RUN RESULTS, this one judges the
TEST CODE. The job is not to paraphrase the code — it's to tell the team **what it verifies,
whether its `expect`s actually prove that, how reliably it runs, and what's wrong with it**.
You explain and audit; you never edit, run, or open PRs — those are sibling skills.

**Pull in `.claude/docs/code-style-guide.md`** (the light-POM / `QuizFlow` engine / fixtures / SOLID /
content-agnostic selector rules you audit against) and `.claude/docs/reporting-guide.md` (how a test is
identified by its `<FOC>-NNN` title + tags, and how to pull its cross-run history from Playwright's own
artifacts). Don't re-derive those mechanics; the steps below assume them.

**The one lens over everything (from CLAUDE.md):** the quiz is DYNAMIC — constant A/B variants. Coverage is
built in **three tiers**: deterministic invariants + the **outcome oracle** (assert hard), the variable
middle (navigated generically, not verified), and copy/order/variant (never asserted). A test is *good* to
the extent it asserts tier-1 and stays out of tier-3. Judge every test through that frame.

## 0. Calibrate depth to the ask
- "What does this test do / explain it / onboard me" → **EXPLAIN only** (step 4). Stop.
- "Review / audit / is it any good / what's wrong with it" → **full assessment** (4 → 5 + verdict).
- "Is X flaky / why does it fail sometimes" → jump to **reliability** (5b: code + history), brief verdict.
- A **file or an area** ("audit the quiz completion tests") → run per-test, then add the area-level
  **coverage map + redundancy** pass (5d). Don't over-deliver on "just explain one test".

## 1. Identify the target (by SEARCH — never a hardcoded id shape)
Accept a partial title, file path, tag, or a `<FOC>-NNN` id (`QZ-001` is an EXAMPLE, not a format to assume).
There are **no `@T`/`@S` ids and no external test-management tool** — a test IS its `<FOC>-NNN` title prefix + tags.
- Title / area / tag / id → grep `tests/web/` for the `<FOC>-NNN`, the title text, or the tag
  (`grep -rn "QZ-001" tests/web/`, `grep -rn "@completion" tests/web/`). A path → read that file.
- **Ambiguous / multiple matches** → list them (title + file + tags) and ask which. Never guess.
- Confirm the resolved target back in one line before diving in.

## 2. Gather efficiently — read only what the test touches
1. The **test body** (the `*.web.test.ts`): title (`<FOC>-NNN` + tags), `beforeEach`, steps, every `expect`.
2. **Only the methods the test calls** — for the quiz these are the **generic engine** (`runToCompletion`,
   `isComplete`, `detectStep`, `answerCurrentStep`, `advance`) on the `QuizFlow` page object, and the
   **oracle** (`apiClient.userExists`, `apiClient.trialBookedFor`). Jump straight to those in
   `lib/pages/*.page.ts` / `lib/api/*`. Do **not** read the whole object.
3. The **data factory** it uses (`quizLead(prefix)` in `lib/data/`) — what it produces (unique tagged
   synthetic lead), controlled vs random.
4. The **requirement** it claims to cover (the `<FOC>-NNN` traces back to a `REQ-QUIZ-NNN` in
   `test-design/quiz/`, the title, or the user's stated intent).
Read top-down; stop pulling files once you can explain and judge it.

## 3. Cross-run history (for any reliability or "is it good" ask)
Per `reporting-guide.md`, there is **no analytics API** — the honest flakiness source is the **last N runs'
`results.json` artifacts** plus **Playwright's own `flaky` status**:
- Compare this test's `status` (by its `<FOC>-NNN` / title) across recent runs' `results.json` (or the HTML
  reports) — alternating green/red with no code change ≈ flaky; a clean green→red switch ≈ a regression.
- A single run reporting `status: "flaky"` (failed then passed on retry) is already a signal — flaky ≠ green.
Hold this until 5b. A brand-new test (no run history yet) has none; say so.

## 4. EXPLAIN (always — the base layer)
Dense prose, no code dump:
- **Verifies** — the one behaviour/requirement, in business terms (e.g. "a fresh lead can complete the quiz
  end-to-end and it results in a real account + booked trial") — not "calls runToCompletion then asserts".
- **Setup** — `beforeEach` (navigates to the entry route), fixtures used (`webClient` / `apiClient` /
  `helpers`), data (`quizLead(prefix)` → the unique tagged synthetic lead the run creates).
- **Steps** — the arrange → act flow: seed the lead, drive the **generic engine** to completion, in order.
- **Assertions** — each `expect`: what it actually checks and at which layer (the flow reached the terminal
  success surface / the API oracle confirms the user exists / the trial is booked).
- **Tags / classification** — `@web @quiz @<feature>`, `@smoke` (funnel-critical), `@mutating` (completes the
  quiz / writes real data), and the `<FOC>-NNN` id.
If the ask was "explain", stop here.

## 5. CRITIQUE (the senior layer — run all five, lead with the worst)

### 5a. Assertion / oracle adequacy — THE killer question
Do the `expect`s actually PROVE the claimed behaviour, or give **false confidence** (green even when the
funnel is silently broken)? Apply the **mutation question**: *"if the funnel were silently broken, would this
still pass?"* Name each weakness explicitly. Hunt for:
- **No outcome oracle** (the killer) — asserting only `isComplete()` / `run.reachedEnd` / a success screen
  **WITHOUT** confirming the business outcome (`apiClient.userExists` + `apiClient.trialBookedFor`). A success
  screen can render while the account/booking silently failed — that mutation slips straight through.
- **Side-effect / proxy instead of the outcome** — asserting a network 2xx fired, a UI flag flipped, or a
  confirmation animation played, rather than the persisted business result (user created + trial booked).
  Assert the *outcome*, at the most stable layer available (API > network-response intercept > stable success surface).
- **"Passes because nothing threw"** — a `runToCompletion` call with no `expect`, or only an `is…()` truthy on
  something always present. No real oracle.
- **Asserting tier-3 content** — checking step copy, option labels, or step count as if it were the oracle:
  that's not confidence, it's a guaranteed false failure *and* it isn't the business outcome anyway.
- **Weak / over-broad** — `toBeTruthy()` on a value that's truthy even when wrong; "the flow ended" without
  "the entity exists"; no assertion that the run actually terminated at success vs bailed on the step cap.
- **Missing** — the requirement says account created *and* trial booked; only one is asserted.
Verdict: does it catch the regression it exists to catch? If not, say which mutation slips through.

### 5b. Reliability — PREDICT from code, then CONFIRM with history
**Predict flakiness from the CODE (Charlie-specific tells):**
- **Unbounded traversal** — a `runToCompletion` / answer→advance loop with **no max-step cap**: a broken or
  looping A/B variant makes it hang instead of failing loudly. The loop MUST be bounded.
- **Content-anchored locators** — `getByText("18-25")` / anchoring on option copy or step wording: breaks the
  instant an A/B variant flips the text. The engine must key on **role/shape**, not content.
- **Asserting variant content** — reading a specific step's copy/order (see 5a) — flakes by design as variants rotate.
- **Completion timeout too tight** — the full quiz + real account creation + booking on **stage** is slow,
  and stage **cold-start** adds latency; a tight per-step or overall timeout races it.
- **Synthetic-lead collision** — a hardcoded / non-unique email instead of a fresh `quizLead(prefix)` per run
  collides across the scheduled runs and the create fails/duplicates.
- Hard `waitForTimeout` sleeps used as logic instead of real `waitFor` / response waits.
**Confirm with the REAL history** (step 3) — combine predicted + observed and label with evidence:
- **stable** (consistently green across recent `results.json`; predicted risks haven't bitten),
- **flaky** (alternating green/red with no code change, or Playwright `status: "flaky"` — *"failed 2 of last 6, no commit between"*),
- **newly-broken** (clean green→red switch ≈ regression).
State both halves: *"predicts flaky (unbounded loop + tight completion timeout on cold-start) AND history
confirms — 2/6 red."* If history contradicts the code smell, say so (latent risk, not yet firing).

### 5c. Code smells — checklist vs `code-style-guide.md`
Flag each present (cite the line/method):
- **Asserting A/B-variable content** (copy / option labels / step order or count) — THE killer smell, tier-3;
- **a per-named-step method** (`answerAgeRange`, `answerGoal`, …) instead of the generic `QuizFlow` engine — dies on the next A/B flip;
- **content-anchored / brittle text locators** (`getByText` on option copy) instead of role/shape-based, content-agnostic ones;
- assertions **inside the POM** (must live in the test);
- `waitForTimeout` sleeps instead of real waits;
- **missing `@mutating`** on a test that completes the quiz / writes real data;
- hardcoded lead data instead of `quizLead()`;
- conditional logic / loops / try-catch in the **test body** (tests must be linear — the loop belongs in `runToCompletion`, not the test);
- **login / session / password assumptions** — there is NO auth; the quiz creates the identity, so any "log in / reuse session" step is wrong by design;
- misused fixtures, a POM method missing `@step()`, or logic that belongs in the object leaking into the body.

### 5d. Coverage & traceability — is it even the RIGHT test?
- Does it actually cover its stated requirement (the deterministic invariants **+** the outcome oracle), or
  only a slice? E.g. drives to completion but never asserts the booking; or checks completion but not the
  "no console errors / no failed 4xx-5xx on the happy path" invariant.
- Does the `<FOC>-NNN` trace to a real `REQ-QUIZ-NNN` in `test-design/quiz/`? Orphan id = traceability gap.
- **Duplication / overlap** with sibling tests — two `@mutating` completion tests asserting the same outcome
  is **doubly costly** here (each completion creates a real user + booking on live stage); flag redundant mutations hard.
- **For a FILE/AREA target:** build a short **coverage map** — requirement/invariant → covered ✓ / gap ✗ —
  plus a redundancy note (which tests overlap, what's missing), framed by the sibling titles in the area.

### 5e. Maintainability
Readability, naming (`<FOC>-NNN` id + clear business-outcome title), DRY (reuses the generic engine +
`quizLead()` vs copy-paste), thin-test discipline (no per-step scripting, selectors, or waits-as-logic in the
body — just seed → drive → assert oracle), correct `@step()` and fixture usage.

## 6. Output — verdict + prioritized routed fixes
Top-down, densest signal first.
1. **Verdict (1 line):** **solid / weak / risky** + the single main reason.
   e.g. *"Risky — green even if the funnel is silently broken (asserts only `isComplete()`, no outcome oracle); also flaky, 2/6 red."*
2. **Explanation** — the step-4 summary (full for an "explain"; condensed for an audit).
3. **Findings, worst first** — oracle gaps → reliability (predicted + history evidence) → smells →
   coverage/traceability → maintainability. One line each, concrete, cite the location.
4. **Prioritized fixes, each ROUTED:**
   - rewrite/strengthen this test, or write a missing one → **`/test-write`** (it edits & opens the PR).
   - re-confirm a suspected flake on CI → **`/run`** (that `<FOC>-NNN` / tag via the `grep` input).
   - check product-vs-test in the latest run → **`/analyze-report`**.
   - a code fix you can't do here → describe it precisely for a PR; **do not edit**.
   Present these as an **`AskUserQuestion` offer** (CLAUDE.md Interaction model) — the user picks; never auto-invoke a sibling skill.

## Stay read-only
Explain and audit only. No code edits, no runs, no PRs — and **never complete the quiz to "check"** (that's a
real mutation on live stage). Name the sibling skill and stop; the user invokes it on their go-ahead.
