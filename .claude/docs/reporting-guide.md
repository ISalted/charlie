# Reporting guide — Playwright-native results, traces & history

Charlie AQA reports through **Playwright's own tooling** — no external test-management tool. This file is
shared knowledge pulled in by the `/analyze-report` and `/run` skills. Execution happens on GitHub Actions
(see `git-ci-guide.md`); this doc is about **reading what a run produced**.

## What a run produces
- **HTML report** (`playwright-report/`, `reporter: [["html"]]`) — the primary artifact. Per-test pass/fail,
  duration, the `@step` tree, attached screenshots and traces. Uploaded as the `playwright-report` CI artifact
  (`if: always()`). Open locally with `npx playwright show-report`.
- **JSON report** (`reporter: [["json", { outputFile: "results.json" }]]`) — machine-readable results for
  scripted triage: `suites[].specs[].tests[].results[]` with `status`, `duration`, `error`, `retry`.
- **Trace** (`trace: "retain-on-failure"`) — a `trace.zip` per failed test: filmstrip, timeline, network,
  console, DOM snapshots per step. Open with `npx playwright show-trace <trace.zip>`. This is the primary
  evidence for a failure. Also `screenshot: "only-on-failure"`.
- **The job result** — with no `continue-on-error`, the GitHub Actions job **fails when tests fail**, so the
  job status is an honest first-order signal (unlike a masked badge).

## Reading a run
- **Did it pass?** → the GitHub Actions **job conclusion** (`gh run view <id>`), or open the HTML report's summary.
- **What failed & why?** → the HTML report (or parse `results.json`): each failed test carries the **error
  message + stack** and a link to its **trace**. Read the message; open the trace for the step-level story.
- **Counts** → `results.json`: total / expected / unexpected / flaky / skipped (`stats` + per-test `status`).
  Or the HTML report header.

## Flakiness — Playwright's own signal
- With `retries` > 0 (CI default), a test that **fails then passes on retry** is reported as **`flaky`** — not
  pass, not fail. Playwright surfaces this in the HTML report and in `results.json` (`status: "flaky"` /
  multiple `results[]` entries with mixed outcomes). Flaky ≠ green: track and triage it.
- **History across runs:** we keep the last N runs' `results.json` as CI artifacts (or a blob store). A test's
  pass/fail pattern across those files is the honest flakiness source — alternating with no code change ≈ flaky;
  a clean green→red switch ≈ a real regression. There is no enterprise analytics layer; this is the substitute.

## Test ids & titles
- **No external ids.** A test is identified by its **`<FOC>-NNN` title prefix** (from `/test-design`) + its tags
  (`@web @quiz @<feature>`, `@smoke`, `@mutating`). Grep/filter by the full `<FOC>-NNN` or a tag.
- Titles come **verbatim** from the checklist; never renumber. There is no reporter that writes ids back into
  source (that was the old Testomatio flow) — the `<FOC>-NNN` in the title *is* the id.

## Running tests
- Trigger GitHub Actions `aqa.yml` (`workflow_dispatch`, input `grep`, or the `schedule` lane) via the **github**
  MCP / `gh` — see `/run`. Results land in the HTML/JSON report artifacts and the job conclusion.

## Common recipes
- **Latest run + result:** `gh run list --workflow=aqa.yml --limit 1` → `gh run view <id>` (conclusion + jobs).
- **Download its report:** `gh run download <id> -n playwright-report` → `npx playwright show-report <dir>`.
- **Why test X failed:** open the HTML report, find X → read its error + open its `trace.zip`
  (`npx playwright show-trace`). Or grep `results.json` for the spec title → `results[].error.message`.
- **Flaky check:** compare a test's `status` across the last few runs' `results.json`; mixed with no code change → flaky.
