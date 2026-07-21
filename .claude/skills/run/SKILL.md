---
name: run
description: Launch a Charlie quiz test run on GitHub Actions from chat — trigger the aqa.yml workflow (workflow_dispatch) for all tests or a filtered subset (by tag like @smoke, or a QZ-NNN test id), and point to where results land. Use when asked to run, launch, execute, kick off, or re-run tests / smoke / the funnel suite on CI.
model: claude-sonnet-4-6
effort: low
---

# /run — launch a test run on GitHub Actions

The CI-DISPATCH action. From chat you **trigger** `aqa.yml` (`workflow_dispatch`) — whole suite
or a filter — resolve the run it started, point to where results land, and hand off to
`/analyze-report`. You do **not** write/fix tests (`/test-write`, `/sdk-builder`), open PRs
(`/open-pr`), or judge results (`/analyze-report`).

Canon — apply, don't re-derive: **`.claude/docs/git-ci-guide.md`** (dispatch, repo, runners) ·
**`.claude/docs/reporting-guide.md`** (where results land + how pass/fail is read). Workflow file
`aqa.yml`, on **GitHub-hosted `ubuntu-latest`**, in the project's fresh **public repo** (default
branch `main`). Two triggers: a **`schedule`** (cron) lane — the primary **synthetic-monitoring**
cadence for this revenue-critical funnel, running itself a few times a day — and **`workflow_dispatch`**
with an input `grep`. **`/run` drives the on-demand `workflow_dispatch`**; the schedule lane runs on its
own. Execution is on GitHub-hosted runners; never locally.

## 0. Calibrate the ask
- **Fire-and-link** (default): trigger, resolve the run, return its URL + what launched. Stop.
- **Trigger-and-watch**: only if asked to wait/watch — poll to completion, then summarize + route.

## 1. Decide the filter (`grep`)
`grep` maps to `npx playwright test --grep "<grep>"` — a Playwright **`--grep` regex over the full
test TITLE (tags included)**.
- **All** → empty (`grep=""`).
- **By tag** → `@smoke` (the critical-funnel filter), `@quiz`, `@mutating`.
- **One test** → its `<FOC>-NNN` id (`QZ-001`). **Use the FULL id** — it's a regex substring, so
  `QZ-00` also matches `QZ-001..009`. Confirm intent if ambiguous.

## 2. Pick the ref
The **ref picks the branch/env**: `main` is the default lane; a feature branch runs that branch's code.
- Default **`main`**.
- **Verifying a NEW test before its PR** (the `/test-write` verify-green step) → dispatch on the
  author's **feature branch**, scoped to the `<FOC>` id. The branch **MUST already be pushed to
  origin** — you dispatch against a remote ref; an unpushed local branch can't be selected.

## 3. Trigger
- Native: `gh workflow run aqa.yml --ref <branch> -f grep="<filter>"`
- Or the **github** MCP `workflow_dispatch` equivalent (workflow `aqa.yml`, `ref`, `inputs.grep`).

## 4. Resolve the run you started
`workflow_dispatch` returns **no run id**. Find it:
`gh run list --workflow=aqa.yml --branch <ref> --event workflow_dispatch --limit 1` → newest run's
id + URL. New run appears within ~30s.
- **Gotcha — if `concurrency: aqa-<ref>, cancel-in-progress: true` is set:** a second dispatch on the
  **same branch cancels the previous in-progress run** on that branch. (The schedule lane runs on its
  own concurrency group, so an on-demand dispatch and the monitoring cron don't fight.)

## 5. Watch (only if asked)
`gh run watch <id>` (or poll `gh run view <id>`). Takes minutes — real browsers driving the live quiz.

## 6. Report + route
Give the run **URL** + what launched (**filter + ref**). State the truth plainly — reporting is
**Playwright-native**:
- The **GitHub Actions job conclusion IS the real pass/fail** — there is **no `continue-on-error`
  masking**, so a red job means real test failures. Trust the badge.
- **`retries` can mark a test `flaky`** — a test that fails then passes on retry is reported as
  `flaky` (not pass, not fail). Flaky ≠ green: it still needs triage.
- Artifacts (`if: always()`): **`playwright-report`** (HTML — the primary artifact, per-test result +
  `@step` tree + attachments) and a **`trace.zip`** per failed test (open with
  `npx playwright show-trace`).
- When it finishes → **offer** (via `AskUserQuestion`, CLAUDE.md Interaction model, don't auto-proceed):
  *[▶ triage with `/analyze-report`] [▶ dig into a failing test with `/analyze-test`] [⏸ stop]*.

## Guardrails
- **Completing the quiz has REAL side effects on live stage** — a finished run creates a real user +
  trial booking. Keep dispatches **minimal / rate-limited**, rely on **synthetic tagged leads**
  (`quizLead`), and prefer the **API oracle** over re-running the flow just to re-check.
- Mutating/completion flows run on **CI only** — **never** run them locally to "test the assistant".
- **Dispatch only** — never push to `main` to trigger a run. Read-only on results: no edits, no merges.
- **Never bypass or solve CAPTCHA / bot-detection, never submit real payment/credentials.** If a run
  hits one, stop and flag it.
