# Git & CI guide — branches, PRs, running on GitHub Actions

Shared knowledge pulled in by the `test-write`, `open-pr` and `run` skills. Repo: **a fresh public
repo** — **`ISalted/charlie`** (https://github.com/ISalted/charlie). Default branch **`main`**.

## Branches & PR flow (the review gate)
- Default branch: **`main`**. **Never push directly to `main`. Never merge** — a human reviews and merges.
- New work → a short-lived branch off `main` → commit → open a **PR to `main`** → reviewer merges → branch deleted.

## PR standards (names & format)
- **Branch:** `aqa/<short-desc>` off `main`, one per task, deleted after merge (e.g. `aqa/qz-001-completion`).
- **Commit & PR title:** conventional commits — `type: subject`, imperative, lowercase. Types in use: `test:`
  (new test), `fix:` (test/code fix), `chore:` / `ci:` / `docs:` (infra/config/docs). For a test, fold in the
  case id: `test: QZ-001 quiz completion creates account and books trial`.
- **PR body:** what it covers · the `<FOC>` id (for a test) · link to the checklist item / requirement · the
  green CI-run link (for test changes) · note **"for review — do not merge"**.
- **Target:** PR into `main`. The PR is the review gate.

## Two ways to do git (both available)
- **Claude Code native** (local repo): `git` + `gh` — branch, commit, push, `gh pr create`.
- **github MCP** (no local repo): `create_branch` → `push_files` / `create_or_update_file` → `create_pull_request`.

## CI — how tests actually run
- Workflow **`aqa.yml`** on **GitHub-hosted `ubuntu-latest`** runners. Triggers:
  - **`schedule`** (cron) — the primary lane. The quiz is a **revenue-critical funnel**, so this is
    **synthetic monitoring**: run a few times a day to catch a broken funnel fast. Alert on failure.
  - **`workflow_dispatch`** — on-demand, with an input **`grep`** (title/tag filter; empty = all).
  - **NOT** triggered on our PRs by default beyond a lightweight lint/type-check — a full completion run
    creates real stage entities, so gate it behind schedule/dispatch, not every push.
- **No login/globalSetup.** The quiz has no auth; a run self-seeds a synthetic lead (`quizLead`) and completes
  the flow. Oracle/API creds come from **GitHub Secrets** (mirroring local `.env`).
- **Reporting is Playwright-native** (detail: `reporting-guide.md`): `html` reporter, `trace: retain-on-failure`,
  `screenshot: only-on-failure`. The **job result is the real pass/fail** (no `continue-on-error` masking).
- Artifacts uploaded `if: always()`: `playwright-report` (HTML) and `trace.zip` per failed test.

## Triggering a run (the `/run` skill)
- Dispatch via the **github** MCP / `gh`: `workflow_dispatch` on `aqa.yml`, `ref` = `main` (or a feature branch),
  `inputs.grep` = filter.
- Filter examples: `@smoke` (a tag), `QZ-001` (one test), empty = whole suite.
- Runs on GitHub-hosted runners (minutes). Don't run mutating/completion flows locally to "test the assistant".

## Scheduling
- The `schedule:` (cron) trigger lives in `aqa.yml` — it IS the monitoring lane. Tune frequency to balance
  funnel-coverage against creating real stage entities (a completion per run). Propose changes as a PR — never push to `main`.

## Side effects & data hygiene (project guardrail)
- A green completion run **creates a real user + trial booking on stage**. Keep runs **minimal and rate-limited**,
  use **tagged synthetic leads** so entities are identifiable, and prefer the **API oracle** over re-running the
  flow to re-check. Never solve CAPTCHA or submit real payment.

## Guardrails
- Always branch + PR; never push to `main`; never auto-merge. The PR is the gate.
