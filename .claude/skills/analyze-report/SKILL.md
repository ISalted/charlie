---
name: analyze-report
description: Triage a Charlie CI test-run report like a senior reliability operator — pick the run (latest or by date), cluster failures by root cause, classify each (product defect | test-code bug | flaky | infra/env | data), separate new regressions from known, weight by severity, judge flakiness from cross-run history, and deliver a layered verdict + routed next actions. Use when asked what the last run did, what failed and why, whether a run is a ship-blocker, to triage/diagnose a run, or whether failures are real vs noise. Read-only — never edits, runs, or merges.
model: claude-opus-4-8
effort: medium
---

# Triage a test run

Read-only. The job is not to list failures — it's to tell the team **what actually happened,
why, what's real vs noise, and what to do**. You interpret results; you never edit code, re-run,
or change run status.

**First read `.claude/docs/reporting-guide.md`** — the HTML report / `results.json` shape, the
trace as evidence, the `<FOC>-NNN` title-is-the-id rule, and the flakiness signal. Don't guess the
mechanics; the steps below assume it. Reporting is **Playwright-native** — no external test tool.

Remember what a Charlie run *is*: the funnel is revenue-critical, so CI is mostly the **`schedule`**
(synthetic-monitoring) lane on GitHub-hosted `ubuntu-latest`, and **every completed run created a real
user + trial on stage**. The quiz is dynamic and runs several A/B tests at once — that shapes how you
classify failures (see step 5).

## 0. Calibrate depth to the ask
- "Did it pass? / how's the last run?" → **one-line verdict** (job conclusion + counts + headline). Stop.
- "What failed / why / triage it / is this a blocker?" → **full triage** (steps 1–9).
- Don't over-deliver on a yes/no question; don't under-deliver on "triage it".

## 1. Pick the run
- **Latest** = `gh run list --workflow=aqa.yml --limit 1` → grab its run id. Newest-first.
- **By date / older** → `gh run list --workflow=aqa.yml --limit 20` and pick by `created`/branch/event
  (`schedule` vs `workflow_dispatch`).
- Inspect it: `gh run view <id>` → job **conclusion** (honest pass/fail — no `continue-on-error` masking),
  jobs, event, branch. Use the **run id** everywhere below.

## 2. Get the counts
- The trustworthy first-order signal is the **job conclusion** from `gh run view <id>`.
- For per-status counts, pull the report artifact:
  `gh run download <id> -n playwright-report` (or the json artifact) → read `results.json` **`stats`**
  (total / expected / unexpected / flaky / skipped) and per-test `status`. Or the HTML report header.
- If the job passed and `unexpected == 0` (flaky may be non-zero) → state healthy, give counts, note any
  flaky, stop (unless asked for more).

## 3. Pull the failures + the real WHY
- From `results.json`, walk `suites[].specs[].tests[].results[]`; the failing ones carry the test title
  (its **`<FOC>-NNN` prefix** *is* the id), `status`, `duration`, `retry`, and **`error.message` + `error.stack`**.
- The **evidence** is two-layered: the error message (read it, don't summarize it away) **and the
  `trace.zip`** — `gh run download <id> -n playwright-report` then `npx playwright show-trace <trace.zip>`
  for the filmstrip / network / console / step-level story. Open the trace for anything non-obvious;
  the message alone rarely tells you *which tier* broke.

## 4. Cluster by error signature
- Group failures whose message/stack/trace are the same shape — **same root cause = one cluster**,
  reported once. Never list the same failure N times because N tests tripped on it.
- Tells of one shared cause: identical assertion, the same missing advance affordance across variants,
  the same failing create/booking request, the same oracle check, a mass simultaneous timeout.

## 5. Classify each cluster by TYPE
Assign one (state the tell). Charlie-specific nuance matters here:

- **Real funnel breakage (product defect — ship-blocker, money burning).** The quiz itself is broken for
  everyone: it **dead-ends** (a step with no working advance affordance), an advance control is
  **gone/broken on all variants**, the **create/booking request errors** (4xx/5xx), or the **outcome
  oracle fails** (no account created / no trial booked) even though the flow "finished". Console errors or
  failed requests on the happy path also land here. *This is the one that blocks — flag it loud.*
- **Test coupled to A/B content (test-code bug — the most common false alarm here).** The test asserted
  **variant copy, an option label, step order, or step count**, and a new A/B variant legitimately changed
  it. The app is fine; the test violated the "don't fix variant content" tier. **The fix is to make the
  test content-agnostic, not a product bug report.** Always sanity-check a "product defect" against this
  before crying wolf.
- **Flaky.** Passes and fails without a code change. Playwright's own **`flaky` status** (failed then passed
  on retry — check `results[]` for mixed outcomes) is direct evidence for one run; confirm persistence via
  history (step 7). Tells: intermittent timeout, occasional element-not-found, green on retry.
- **Infra / environment.** Not the test or the app: GitHub-hosted-runner issue, network blip, or a
  **stage cold-start** (first hit after idle — slow to warm). Tells: mass simultaneous timeouts, the entry
  route not loading, runner setup failures.
- **Data issue.** **Synthetic-lead collision** or leftover state — a `quizLead(...)` email that wasn't
  unique, or residue from a prior mutating run. Tells: "already exists" / not-found on data the test seeded.

## 6. New regression vs known — diff the previous run
- Download the **previous** run's `results.json` (`gh run list` → prior id → `gh run download`).
- A test failing in **both** = **known/pre-existing**; failing **only now** = **new regression**.
  New regressions are the headline; known failures are backlog, not news.

## 7. Reliability — judge flakiness from cross-run history (never one run)
- One run's `flaky` status is a strong hint; **persistence** needs history. Pull the last few runs'
  `results.json` (`gh run list --workflow=aqa.yml --limit 6` → `gh run download` each) and compare a
  test's `status` across them.
- Label with evidence: **stable** (consistently green, this fail is new/real),
  **flaky** (alternating green/red — or repeatedly `flaky` — with no code change, e.g. "failed 2 of last 5"),
  **newly-broken** (clean green→red switch ≈ regression), **recently-fixed** (red→green). There is **no
  enterprise analytics layer** — the run artifacts are the honest source.

## 8. Severity weighting
- Weight a failure by the **failing test's area / tags**, not by count. A break in the **critical funnel**
  (`@smoke`, the outcome oracle, `@mutating` completion) outranks a cosmetic/edge case.
- **1 critical failure > 5 low ones.** Lead with the highest-severity real failure — a broken funnel is
  revenue lost, not a red badge.

## 9. Trend
- Scan recent job conclusions: `gh run list --workflow=aqa.yml --limit 8` → better/worse than the recent
  norm? One bad run in a green streak (likely infra/flake on a cron lane) reads differently than the fifth
  red in a row (a real funnel regression nobody's fixed).

## Output — layered verdict + routed actions
Write top-down, densest signal first. **Be honest: "the test failed" ≠ "the product is broken."**
Most failures here are A/B-coupling / infra / flake — don't cry wolf; equally, never bury a real funnel break.

1. **Headline (1 line, for anyone — manager/business):** ship-blocker yes/no + the gist.
   e.g. *"Latest aqa.yml [schedule]: 12/13 green. Funnel healthy — 1 test coupled to a new A/B step-count (test bug, not product), 0 real regressions."*
2. **Counts + trend:** expected/unexpected/flaky/skipped, job conclusion, vs previous run / recent norm.
3. **Per cluster (highest severity first):** type · new-vs-known · likely **root cause** · the **evidence**
   (the error message + trace observation + the history verdict). One entry per cluster.
4. **Routed next actions, prioritized — each pointing somewhere:**
   - real funnel breakage → describe it for a **bug report to the Charlie team** (don't file it yourself).
   - test coupled to A/B content, or any failing test to dig into → **`/analyze-test <FOC-NNN or title>`**
     (audit the code; the fix is usually making it content-agnostic).
   - suspected flake to re-confirm → **`/run`** (re-run that tag/id — mindful it's a mutating completion).
   - coverage gap exposed → **`/test-write`**.
   Present these as an **`AskUserQuestion` offer** (CLAUDE.md Interaction model) — the user picks; never auto-invoke a sibling skill.

## Stay read-only
Report and route only. No code edits, no re-runs, no run-status changes — those are the
sibling skills' jobs, invoked on the user's go-ahead. Never trigger a re-run casually: completing the
quiz on stage creates real entities.
