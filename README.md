# Charlie AQA

Automated coverage for the **Charlie registration quiz** — the paid-traffic sign-up funnel of the
Allright app. A user answers quiz steps and, on completion, an **account is created and a trial lesson
is booked**. This funnel is revenue-critical, so the goal is to catch a broken funnel fast.

> **The quiz is not static.** It changes constantly and almost always runs **several A/B tests at once** —
> steps, texts, order, and the set of screens differ between users and week to week. This suite is designed
> around that reality, not against it.

## The approach in one screen — three tiers by stability

| Tier | What | How we treat it |
|---|---|---|
| **Deterministic** | Invariants true in *every* variant (entry loads, each step has one advance affordance, progress moves forward, no dead-ends, no console/4xx-5xx errors) **+ the business outcome (account created + trial booked)** | **Assert hard.** Outcome via the most stable signal: API > network-response intercept > a stable success surface. |
| **AI-agent / heuristic** | Navigating the *variable middle* — read whatever step is on screen, pick a valid answer, advance, until completion | **Adaptive, not pinned.** Reach the end; don't verify specific step content. |
| **Don't fix** | Exact copy, step count/order, which A/B variant, visuals | **Never assert.** At most an informational drift snapshot that never fails the build. |

**Why it survives A/B changes without a rewrite:** the assertions sit on invariants + the outcome (which
don't change); the variable middle is navigated generically, not scripted step-by-step. No per-step selectors
to maintain when a variant flips.

## Layout

```
lib/
  config/           env config (BASE_URL, API_URL, oracle creds) via dotenv / CI secrets
  fixtures.ts       the 3 fixtures: webClient / apiClient / helpers
  pages/
    base.page.ts        BasePage
    allright-app.ts     WebClient (composes page mixins) + AppRoute
    mixins.ts           page mixins
    quiz.page.ts        the light QuizFlow object (generic step engine — filled by the skill pipeline)
    quiz.types.ts       StepKind / QuizRunResult
  data/quiz/          quizLead(prefix) → synthetic tagged leads
  api/api-client.ts   the OUTCOME ORACLE (verify user + booking)
  helpers/            step decorator + generic utils
tests/web/quiz/       the thin tests
test-design/quiz/     REQUIREMENTS.md + CHECKLIST.md (design artifacts)
.github/workflows/aqa.yml   GitHub Actions (schedule + workflow_dispatch)
.claude/              the AI skill pipeline + canon docs (see below)
```

## Run

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env         # fill BASE_URL, and API_URL/creds if available

npm test                     # run all
npm run grep -- @smoke       # run the critical funnel check
npm run ui                   # Playwright UI mode
npm run report               # open the last HTML report
```

**Reporting is Playwright-native:** HTML report + `trace: retain-on-failure`. Open a failure's trace with
`npx playwright show-trace`. On CI the GitHub Actions job result is the honest pass/fail (no masking).

## CI

`.github/workflows/aqa.yml` runs on GitHub-hosted `ubuntu-latest`, triggered by **`schedule`** (synthetic
monitoring — the primary lane) and **`workflow_dispatch`** (on-demand, with a `grep` filter). Not per-PR: we
don't own the quiz's product repo, and each completion creates real stage entities. Secrets: `BASE_URL`,
`API_URL`, `API_TOKEN`, `QUIZ_EMAIL_DOMAIN`.

## Assumptions made (validate with the Charlie team)

- **Outcome oracle signal.** The strongest oracle is a stage **API** to confirm the created user + booking.
  The endpoints in `lib/api/api-client.ts` are **placeholders**; until `API_URL` + creds are provided, the
  suite falls back to the **network-intercept** oracle (`helpers.waitForOkResponse`). Request the real
  contract from the Charlie team.
- **Synthetic lead domain.** `quizLead()` tags emails with `QUIZ_EMAIL_DOMAIN` (default `aqa.example.com`) —
  replace with the test domain the team designates for synthetic sign-ups so entities are identifiable and
  don't pollute analytics.
- **No CAPTCHA / real payment on the happy path.** If completion requires solving a CAPTCHA, an OTP, or real
  payment, that's a hard blocker — request a stage test-hook; the suite never bypasses bot-detection or
  submits real financial data.

## Guardrails

- Completion has **real side effects on live stage** (a real user + trial booking) → synthetic tagged leads
  only, runs kept minimal, prefer the API oracle over re-running the flow.
- Never bypass/solve CAPTCHA; never enter real payment or credential data.
- Never assert on A/B-variable content. Branch `aqa/<short-desc>` → PR to `main`; a human reviews and merges.

## The AI skill pipeline (`.claude/`)

Work flows through focused skills, each owning one layer:
`/analyze-requirements` → `/test-design` → `/analyze-page` (locators) → `/sdk-builder` (methods) →
`/test-write` (the thin test). Support: `/run`, `/analyze-report`, `/analyze-test`, `/open-pr`, `/analyze-cost`.
The always-on rules live in `CLAUDE.md`; the deep detail in `.claude/docs/`.

## What I'd do next with more time

- Fill the `QuizFlow` engine locators + methods against the live stage quiz (`/analyze-page` → `/sdk-builder`),
  then the first thin completion test (`/test-write`).
- Wire the real API oracle once the Charlie team provides the endpoints/creds.
- Add an informational **drift snapshot** artifact (step kinds/count per run) that reports A/B changes without
  failing the build.
- Add alerting on a failed scheduled run (the funnel being down = money burning).
