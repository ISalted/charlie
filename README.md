# Charlie AQA

Automated coverage for the **Charlie registration quiz** — Allright's paid-traffic sign-up funnel.
A user answers quiz steps and, on completion, an account is created and a trial lesson is requested.
The funnel is revenue-critical, so the goal is to **catch it breaking fast**.

**The quiz is not static.** It changes constantly and almost always runs several A/B tests at once —
steps, texts, order, and the set of screens differ between users and week to week. This suite is
built around that reality: it asserts **invariants + the business outcome**, and navigates the
variable middle **generically** (by control shape, not by copy) — so an A/B flip needs no rewrite.

## Part B — Variant 1: resilient business-outcome check

The core deliverable is [`tests/web/quiz/completion.web.test.ts`](tests/web/quiz/completion.web.test.ts)
(`QZ-002`, `@mutating`). It drives **whatever variant is served** to the end and asserts the
variant-independent result:

- **Account created** — `POST /api/v1/users` returned 2xx (read from the network, no API creds needed).
- **Trial requested** — the flow reached the confirmation surface `/app/request-gotten`.

> Observed on stage: the trial is a **request** an admin schedules later — there is **no** immediate
> booking call (`POST /api/v1/lessons` never fires). So its variant-independent proof is the
> confirmation surface, not a booking POST.

A second non-mutating test, [`smoke.web.test.ts`](tests/web/quiz/smoke.web.test.ts) (`QZ-001`), is the
cheap health check: the entry loads and the generic engine classifies the first step on any variant.

## How it survives A/B changes

The engine ([`lib/pages/quiz.page.ts`](lib/pages/quiz.page.ts)) is a **generic step loop**, not a
per-step script: on each screen it reads the *shape* of the controls — input → fill, options →
pick one, only a CTA → click — and advances until it reaches a success surface. It also clears the
interstitial overlays the funnel throws up (the required "who's filling this?" picker, the random
exit-intent popup). Only **four contract points** would force a rewrite, and none is A/B content:
`[data-step-name]`, the primary-CTA class `.btn.orange`, `POST /api/v1/users`, and the success URL.

Everything else — copy, step order/count, which variant — the tests ignore by design.

## Run

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env          # BASE_URL is enough to start; API_URL/token optional
npm test                      # all tests
npm run grep -- @smoke        # non-mutating funnel health check only
npm run ui                    # Playwright UI mode
npm run report                # open the last HTML report
```

Reporting is Playwright-native: HTML report + `trace: retain-on-failure`. Open a failure's trace with
`npx playwright show-trace`.

## CI — [`.github/workflows/aqa.yml`](.github/workflows/aqa.yml)

Runs on GitHub-hosted `ubuntu-latest`, triggered by **`schedule`** (every 6h — synthetic monitoring of
the money path) and **`workflow_dispatch`** (on-demand, with a `--grep` input). **Not per-PR:** we don't
own the quiz's product repo, and every completion creates real stage entities. Secrets: `BASE_URL`,
`API_URL`, `API_TOKEN`, `QUIZ_EMAIL_DOMAIN`. The job result is the honest pass/fail; the HTML report is
uploaded as an artifact.

## Assumptions (confirm with the Charlie team)

- **Outcome signal.** The strongest oracle is a stage API confirming the created user + request. The
  endpoints in [`lib/api/api-client.ts`](lib/api/api-client.ts) are placeholders; without `API_URL` +
  a token the suite uses the network-intercept oracle (`helpers.captureQuizOutcome`).
- **Synthetic lead domain.** `quizLead()` tags emails with `QUIZ_EMAIL_DOMAIN` (default
  `aqa.example.com`) — swap for the domain the team designates for synthetic sign-ups.
- **No CAPTCHA / OTP / real payment on the happy path.** If completion ever requires one, that's a hard
  blocker — request a stage test-hook. The suite never bypasses bot-detection or submits real data.

## Guardrails

- Completion has **real side effects** on live stage → synthetic tagged leads only, runs kept minimal.
- Never bypass/solve CAPTCHA; never enter real payment or credential data.
- Never assert on A/B-variable content. Branch `aqa/<short-desc>` → PR to `main`; a human merges.

## What I'd do next with more time

- Wire the real **API oracle** once the team provides endpoints/creds (stronger than the network signal).
- **Alerting** on a failed scheduled run (funnel down = money burning) — Slack summary + report link.
- An informational **drift snapshot** (step kinds/count per run) that flags A/B changes without failing.
- Parallel runs via separate synthetic profiles once volume justifies the data management.
