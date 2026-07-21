# Charlie AQA — project guide for Claude

AQA suite for the **Charlie registration quiz** — the paid-traffic sign-up funnel of the Allright
app (Playwright + TypeScript). Entry: `/uk/app/sign-up/long/charlie/age-range` on **stage**. The quiz
walks a user through steps and, on completion, **creates a real account and books a trial lesson**.
Tests run on **GitHub Actions (GitHub-hosted runners)** and report via **Playwright's own HTML report +
traces** — no external test-management tool. Fresh **public repo** (default branch `main`).
This file is the **short always-on layer**; the deep detail lives in `.claude/docs/` (below) and the
skills pull it in — don't duplicate it here.

## The one thing that shapes everything: the quiz is NOT static
The quiz changes constantly and **almost always runs several A/B tests at once** — steps, texts, order,
and the set of screens differ between users and week to week. So coverage is designed in **three tiers by
stability**, and every skill/doc reflects this:
- **Deterministic (assert hard)** — invariants true in *every* variant: the entry loads; each step has
  exactly one primary "advance" affordance; answering + advancing moves progress forward; no dead-ends;
  no console errors / no failed (4xx/5xx) requests on the happy path; **and the business outcome —
  account created + trial booked**, checked via the most stable signal available (API > network-response
  intercept > a stable success surface, in that order).
- **AI-agent / heuristic (adaptive, not pinned)** — navigating the *variable middle*: "read whatever step
  is on screen, pick a valid answer, advance," until completion. The goal is to **reach the end**, not to
  verify specific step content.
- **Don't fix at all** — exact copy/wording, the number/order of steps, which A/B variant was served,
  visual layout, option labels. Asserting these = perpetual false failures. At most capture them as an
  **informational drift snapshot** that never fails the build.

**Why it survives A/B changes without a rewrite:** the deterministic assertions sit on invariants + the
outcome (which don't change); the middle is navigated generically, not scripted step-by-step. No per-step
selectors to rewrite when a variant flips. You only touch the tests if the **business contract** changes.

## Canon docs (`.claude/docs/`) — the deep layer the skills pull in
- `code-style-guide.md` — POM / SOLID / fixtures / **light `QuizFlow` engine** vs page-vs-component rule.
- `playwright-guide.md` — locator priority ladder + **generic step-anatomy** extraction (no framework assumptions).
- `git-ci-guide.md` — branches + **PR standards** (branch `aqa/<short-desc>` → `main`), GitHub Actions.
- `reporting-guide.md` — Playwright HTML report, traces, and how a run's pass/fail is read (no external tool).

## Stack & layout
- Playwright + TypeScript, Page Object Model. Objects extend `BasePage`; **flows live in the objects**, not tests.
- **The quiz is dynamic → the POM is LIGHT.** Model it as a **`QuizFlow`** object with **generic
  step-handling methods** (`detectStep`, `answerCurrentStep`, `advance`, `isComplete`, `runToCompletion`),
  **not** one method per named step. Only stable, contract-level screens (entry, the final success/booking
  surface) may get their own named handles.
- `lib/pages/` — page objects (`*.page.ts`, e.g. `quiz.page.ts`) and component objects (`components/*.component.ts`,
  a region reused on ≥2 pages — page-agnostic, no `AppRoute`). Bound to one route → page object; across pages → component.
- `lib/pages/mixins.ts` — the **mixin functions**. `lib/pages/allright-app.ts` — composes them into `WebClient` **and** declares `AppRoute`.
- `lib/data/` — test data: faker factories (e.g. `quizLead(prefix)` → synthetic leads) and known fixtures.
- `lib/api/` — API clients used by the **outcome oracle** (verify the created user + booking) and setup/teardown.
- `lib/helpers/` — generic, page-agnostic utils ONLY. `lib/fixtures.ts` — fixtures `webClient` / `apiClient` / `helpers`.
- `tests/web/<area>/*.web.test.ts` — tests (primary area: `quiz`).
- `test-design/<area>/` — **design artifacts**, one folder per area mirroring the test areas: `REQUIREMENTS.md`
  (by `/analyze-requirements`) + `CHECKLIST.md` (by `/test-design`). The spec layer — never in `lib/`, never the repo root.
- Path aliases: `@lib @pages @data @api @helpers @root`.

## Auth model — INVERTED vs a typical admin app
- **There is no login.** The quiz is public paid-traffic; **completing it CREATES the account** (and books
  the trial). So there is **no session to reuse, no password to type, no `globalSetup` login**. The identity
  under test is *produced by* the flow, not a precondition of it.
- Each run therefore self-seeds a fresh **synthetic lead** (`quizLead(prefix)` → a unique, tagged email) so
  runs don't collide and the created entities are identifiable.

## The outcome oracle (the crown jewel of every test)
The business result — **account created + trial booked** — is the same regardless of which screens led there,
so it's the variant-independent assertion. Prefer the most stable signal:
1. **API / backend** — query the created user and the booking (`apiClient`). Best; needs stage API access.
2. **Network-response intercept** — assert the create/booking request(s) returned 2xx with the expected payload.
3. **Stable success surface** — a confirmation screen matched by a **stable test-id/role**, not localized copy.
Assert on (1) or (2) where possible; (3) is the fallback. Never assert on the exact wording of a success screen.

## App surface & routes
- Entry route in `AppRoute` (`lib/pages/allright-app.ts`): the quiz start
  `/uk/app/sign-up/long/charlie/age-range`. Use `webClient.goTo(route)` — **relative to `baseURL`**, never a full URL.
- Config: `lib/config/index.ts` reads `BASE_URL` (stage), `API_URL`, and any oracle creds from `process.env`
  (local `.env` via `dotenv`; CI = GitHub Secrets). **Same code, different secrets** to switch envs.
- Currently automated: **the Charlie long sign-up quiz, entry → completion**.

## Fixtures & architecture (detail: `code-style-guide.md`)
- Every test: `import { test, expect } from "@lib/fixtures";`
- Three fixtures: **`webClient`** (all UI work; composes page mixins — exposes `.quizPage`, `.goTo(route)`, and
  `.page` raw Playwright `Page` only when unavoidable); **`apiClient`** (the outcome oracle + setup);
  **`helpers`** (generic, page-agnostic utils).
- **Component objects** are reached **through their page** — `webClient.quizPage.<component>.…`, never `webClient.<component>`.
- POM methods **act and return** (never assert); each public method is decorated `@step()` (`@helpers/step`)
  → a named step in the Playwright report. Keep that on new methods.
- `webClient.waitForTimeout(n)` takes **seconds**, not ms. Prefer real waits over sleeps.

## Conventions (match these when writing tests)
- **Title:** `<FOC>-NNN: <what it verifies> @tags` — `<FOC>` is a 3-letter **focus code** (e.g. `QZ` quiz) +
  sequential `NNN`; ids come **verbatim from `/test-design`**, never invent or renumber.
- **Tags:** `@web @<area> @<feature>` (+ `@mutating` for anything that completes the quiz / writes real data).
  `@smoke` is the load-bearing grep filter for the critical funnel check.
- **Test data:** `quizLead(prefix)` → controlled, tagged synthetic leads (e.g. `aqa.<prefix>.<stamp>@<test-domain>`).

## Test-writing style (detail: `code-style-guide.md` + the `/test-write` skill)
- **Assertions live in the test, never in objects** — methods act-and-return; the test asserts:
  `expect(await quiz.isComplete()).toBeTruthy();`. **Every test has an explicit `expect`** — no "passes because nothing threw".
- Tests stay **thin**: `beforeEach` navigates to entry; the body drives the generic flow; then asserts the **outcome oracle**.
- **Assert invariants + outcome, never variant content.** A test that reads a specific step's copy is wrong by design.

## How tests run
- **CI is the main lane:** GitHub Actions workflow (`aqa.yml`) on **GitHub-hosted `ubuntu-latest`**, triggered by
  **`schedule`** (synthetic monitoring — the funnel is revenue-critical) **and `workflow_dispatch`** (on-demand).
  **Not** per-product-PR: we don't own the quiz repo, and each completion creates real entities.
- **Reporting is Playwright-native:** `html` reporter + `trace: retain-on-failure` + `screenshot: only-on-failure`.
  Real pass/fail = the Playwright report / the job result; failures ship a `trace.zip` artifact (open with `npx playwright show-trace`).
- **Local (for the human):** `npm run test` / `npm run ui` (Playwright UI) / `npm run headed`. Mutating completion
  runs are for CI + synthetic data, not for casually "testing the assistant" locally.

## MCP tools (this project)
- `playwright` → drive the live quiz to read **real selectors** / study the generic step anatomy when authoring.
- `github` → branches, pull requests, trigger `workflow_dispatch`.

## App access
- BASE_URL (stage): `https://stage.allright.com`; quiz entry `/uk/app/sign-up/long/charlie/age-range`.
- No auth to the quiz itself. Oracle/API creds (if any) come from stage — **request them from the Charlie team**;
  never hardcode. `.env`, `.mcp.json` are gitignored.

## ⛔ Guardrails (never violate)
- **Completion has REAL side effects on live stage** — a finished run creates a real user + trial booking.
  Use **synthetic tagged leads only** (`quizLead(...)`), keep runs **rate-limited / minimal**, and don't
  pollute product analytics. Prefer the API oracle over re-running the full flow to "check".
- **Never bypass or solve CAPTCHA / bot-detection.** If the flow hits one, stop and flag it — don't automate around it.
- **Never enter real payment, card, or personal-credential data.** If completion requires payment/OTP, request a
  stage test-hook from the Charlie team; do not fake or submit real financial data.
- **Don't assert on A/B-variable content** (copy, step order, which variant) — that's the "don't fix" tier.
- **Git: branch `aqa/<short-desc>` + PR to `main`. Never push to `main` directly. Never auto-merge** — a human reviews.
- **Read-only exploration:** analysing via the `playwright` MCP is read-only; **completing the quiz is a real
  mutation** — only do it intentionally as the behaviour under test, never "just to look around".

## Authoring workflow — the skill pipeline
Work flows through focused skills, each owning ONE layer (invoke `/<name>`):
1. **`/analyze-requirements`** — business input / the dynamic-quiz reality → atomic, **testable** `REQ-<AREA>-NNN`
   requirements + acceptance criteria (`test-design/<area>/REQUIREMENTS.md`), ambiguity **asked-or-flagged**.
2. **`/test-design`** — requirements/quiz → a prioritized, deduplicated `<FOC>-NNN` checklist
   (`test-design/<area>/CHECKLIST.md`; each case traces to a `REQ-`). Cases target **invariants + outcome**, not variant content.
3. **`/analyze-page`** — study the live quiz's **generic step anatomy** → write **verified locators** into a
   page/component object (light `QuizFlow` shape); scaffold the object + mixin + `WebClient` wiring + `AppRoute` (page only).
4. **`/sdk-builder`** — add the `@step` act-and-return **methods** (the generic step engine + the oracle) on those locators.
5. **`/test-write`** — write the **thin test** that consumes the SDK, verify it green on CI, open **its own PR**.

Support skills: **`/open-pr`** (land a non-test / batched change-set), **`/run`** (trigger a CI run),
**`/analyze-report`** (triage a run from the Playwright report — read-only), **`/analyze-test`** (audit a test's code — read-only),
**`/analyze-cost`** (token/cost lens on a session/run — read-only).

**Layer rule:** tests never touch `lib/`; locators (`/analyze-page`) ≠ methods (`/sdk-builder`) ≠ tests (`/test-write`).
Branch `aqa/<short-desc>` + PR to `main`; a human reviews and merges.

## Interaction model (skills guide you, step by step)
Skills are a **guided assistant, not a black box** — use the interactive question UI (`AskUserQuestion`), and
**offer, never auto-proceed**:
- **Missing info / ambiguity** → ask one focused question with options before acting.
- **A skill finished (layer boundary)** → report what was produced, then **offer the next step** with options —
  e.g. *[▶ proceed to `/sdk-builder`] [✏ adjust] [⏸ stop]*.
- **Side-effecting action** (CI run, PR, completing the quiz on stage) → confirm before doing it (see Guardrails).
Don't gate read-only work or within-layer micro-steps — that's friction, not guidance.
