---
name: test-design
description: Design a prioritized, deduplicated test-case CHECKLIST for the Charlie sign-up quiz (a feature, page, or requirement) BEFORE any automation — systematically applies the full test-design technique grid (equivalence partitioning, boundary values, decision tables, state transition, pairwise, plus security, accessibility, persistence, i18n) THROUGH the three-tier resilience model, and outputs a checklist of concrete, ID'd cases in the project's format. Use when asked to create test cases, a checklist, test scenarios, coverage, or to "break down" / decompose a feature or requirement into cases. This is the step AFTER /analyze-requirements (it consumes the `test-design/<area>/REQUIREMENTS.md` artifact) and BEFORE /test-write.
model: claude-opus-4-8
effort: high
---

# Design a test-case checklist

The **design** phase of the QA pipeline: a requirement — ideally the `REQUIREMENTS.md`
(at `test-design/<area>/REQUIREMENTS.md`, written by `/analyze-requirements`), or a feature / page
directly — becomes a prioritized,
**deduplicated** checklist of cases. Fed a requirements artifact, **trace each case to its
`REQ-<AREA>-NNN`** so coverage maps back to a need. Each case is concrete enough that
`/test-write` can later automate it as **exactly one** test. You apply test-design theory
deliberately — not improvise — and the bar is ISTQB-grade: **minimal but sufficient**.

Output is a single markdown file at **`test-design/<area>/CHECKLIST.md`** — the project's home for
design artifacts, one folder per area mirroring `tests/web/<area>/` (`quiz`, …); never
the repo root and never `lib/`. This skill is self-contained:
the format, ID scheme, priority legend, technique grid, and process are all below. The
project `CLAUDE.md` guardrails always apply.

## The thing that shapes every case: the quiz is NOT static

Charlie is the paid-traffic sign-up quiz — it changes constantly and **almost always runs several A/B
tests at once** (steps, copy, order, and the set of screens differ between users and week to week). So
cases are not designed against a fixed script; they are designed against the **three-tier resilience
model**, and every case you write MUST declare which tier it serves:

1. **Deterministic (assert hard)** — invariants true in *every* variant, plus the business **OUTCOME**.
   Invariants: the entry loads; each step has exactly one primary "advance" affordance; answering +
   advancing moves progress forward; no dead-ends; back works; no console errors and no failed
   (4xx/5xx) requests on the happy path. Outcome: **account created + trial booked**, checked via the
   most stable signal available (API > network-response intercept > a stable success surface). These are
   the cases that carry weight — design them thoroughly.
2. **AI-agent / heuristic (adaptive)** — cases that navigate the *variable middle* generically: "read
   whatever step is on screen, pick a VALID answer, advance," until completion. The oracle is **reaching
   the end on any variant**, not verifying specific step content. Design these as *behaviours of the
   generic engine* (`detectStep` classifies every step kind it meets; `answerCurrentStep` produces a
   valid answer for each kind; `runToCompletion` terminates within a bounded step budget), never as a
   walk of named steps.
3. **Don't fix at all** — exact copy/wording, the number/order of steps, which A/B variant was served,
   visual layout, option labels. These MUST NOT become test cases. Asserting them = perpetual false
   failures. List them under `## Do not automate — A/B-variable content` (below), with the reason. At
   most they can be captured as an **informational drift snapshot** that never fails the build.

**Rule of thumb:** a case that reads a specific step's copy, pins the step count/order, or names an A/B
variant is *wrong by design* — it belongs in tier 3, not the checklist.

## Guiding philosophy — meaningful coverage, not a billion tests

- **Collapse the input space.** Use equivalence partitioning + boundary analysis to pick
  ONE representative per class — not every value. The space of inputs is infinite; the
  set of distinct *behaviours* is small. Test the behaviours.
- **One distinct behaviour per case.** If two cases would pass/fail for the same reason,
  they are the same case.
- **Dedup is a discipline, not an afterthought.** After deriving cases, actively merge or
  delete any that assert the same thing through a different door.
- **Risk-based prioritization.** Order by impact × likelihood. Spend cases where failure
  hurts (a broken funnel = lost revenue, no account/booking, security), not on cosmetics.
- **Minimal-but-sufficient — the completeness contract:** every requirement / acceptance
  criterion, every invariant, every step *kind*, every generic-engine transition, the outcome, and
  every identified risk is covered by **≥ 1** case, with **zero** redundancy. More cases than that is
  graphomania; fewer is a coverage gap. (Note: coverage is over invariants + step *kinds* + outcome —
  NOT over the number of steps, which is variant-bound.)

## Quality bar — what every single case must satisfy

A case earns its line only if it is ALL of:
- **Atomic** — one behaviour. Not "answer step and advance and complete".
- **Observable** — asserts something you can actually read from the UI, a network response, or the API.
- **States the expected result** — the action AND its outcome, not just the action.
- **Assertion-able** — a clear pass/fail oracle, not "looks right".
- **Variant-independent** — keys on an invariant, a step *kind*, or the outcome — never on variant copy,
  step order, or which A/B branch was served.
- **Automation-ready** — concrete enough for `/test-write` to write directly, driving the light
  `QuizFlow` engine and asserting the outcome oracle.

Bad: `the quiz works`. Bad: `step 3 shows the "How old are you?" heading`.
Good: `QZ-004: On every step reached during traversal, exactly one primary advance affordance is enabled; clicking it increases progress (high)`.
Good: `QZ-001: Completing the quiz with a synthetic lead creates the account and books the trial, verified via the API oracle (critical) @smoke`.

## Case IDs — `<FOC>-NNN`

Every case gets a per-area code: a **3-letter focus prefix** + a zero-padded **sequential
number**, e.g. `QZ-001`, `QZ-014`, `QZ-007`.

- **Choose the 3-letter focus code** from the area/feature being designed — a memorable,
  uppercase, area-scoped abbreviation. For the sign-up quiz the focus code is **`QZ`** (area `quiz`).
  A future sub-area would get its own (e.g. Outcome oracle → `OUT`). Use ONE focus code
  per checklist file (the whole file is one area).
- **Number sequentially** across the whole file, `001`, `002`, … in the order cases
  appear. The number is global to the file, not restarted per `##` section.
- **Continue existing numbering.** If a checklist for this area/focus already exists in
  the repo, find the highest `<FOC>-NNN` and start at the next integer —
  never reuse or renumber issued ids; they become downstream test titles.
- These ids flow straight into `/test-write` as the test title prefix, so they must be
  stable and unique. There is no external test-management id — the `<FOC>-NNN` IS the id.

## Output format — `CHECKLIST.md` (exact)

Write the file with this structure, nothing extra:

```
# <Area> — Test Checklist

Targets <the flow/feature, e.g. the Charlie long sign-up quiz, entry → completion>.
**Out of scope:** <e.g. exact step copy / count / order (see Do not automate); payment/OTP flows>.

**Priority legend:** `critical` = blocks the funnel, prevents account/booking, or exposes a security
hole · `high` = an invariant or generic-engine behaviour the funnel depends on · `medium` = secondary
behaviours & common edge cases · `low` = cosmetic / rare / nice-to-have.

**Test-design techniques applied:** <list only the ones you actually used, e.g.
equivalence partitioning, BVA, decision tables, state transition, pairwise, error
guessing, exploratory, security, accessibility, persistence, i18n>.

---

## <Section — e.g. Entry & Invariants (deterministic)>

- [ ] QZ-001: <one specific, observable, variant-independent behaviour + its expected result> (priority) `[REQ-<AREA>-NNN]`
- [ ] QZ-002: <…> (priority)

## <Section — e.g. Generic traversal (heuristic)>

- [ ] QZ-003: <…> (priority)

## Do not automate — A/B-variable content

- [ ] <content/behaviour that MUST NOT be pinned + why, e.g. exact step copy / step count / step order /
      which A/B variant — asserting it causes perpetual false failures (tier 3); at most a non-failing
      drift snapshot> (n/a)

## Deferred — do not implement

- [ ] QZ-NNN: <forbidden/destructive case + why deferred, e.g. solving a CAPTCHA — violates CLAUDE.md
      guardrail, never automate> (n/a)
```

Rules:
- Group cases into `## <Section>` blocks by concern (Entry & Invariants, Generic Traversal, Outcome
  Oracle, Step-Kind Handling, No-Dead-End / Back Navigation, Console & Network Health, Data Hygiene,
  Security, Accessibility, Resilience/Error Handling…). Sections are organizational; **ids stay globally
  sequential** across them. Prefer sections that name the tier a group serves.
- Every case line is `- [ ] QZ-NNN: <behaviour + expected result> (priority) [REQ-<AREA>-NNN]`. The
  `[REQ-…]` tag **traces the case to the requirement it covers** (from `/analyze-requirements`); use
  `[REQ: none]` when fed a page/feature directly with no `test-design/<area>/REQUIREMENTS.md`.
- The **`## Do not automate — A/B-variable content`** section is **mandatory** — it captures the tier-3
  content (copy, step count/order, which variant, visuals) so it is explicitly *ruled out*, never
  silently designed against nor silently dropped.
- The **`## Deferred — do not implement`** section is mandatory whenever a destructive or
  forbidden case surfaces — it is listed there, never silently dropped, and never handed
  to `/test-write`.

## The technique grid (the professional core)

After building the inventory (process step 2), run **each invariant / step-kind / input / engine-state /
action through this grid**, deliberately. Each line is the one-line how-to. Then dedup. Always ask, for
each candidate: *which tier does this serve?* — and drop anything that lands in tier 3.

**Specification-based (derive from spec/UI structure):**
- **Equivalence partitioning** — split each input into valid / invalid / empty classes;
  emit ONE case per class (this is the primary space-collapser). For the quiz, partition by **step kind**
  (single-choice, multi-choice, free-text, date, info/continue-only) rather than by named step.
- **Boundary value analysis (BVA)** — for each ordered domain test min, max, just-under,
  just-over, empty, and max-length (e.g. free-text at limit vs limit+1; date at the youngest/oldest
  accepted age; the traversal step-budget at its bound — completes within N vs exceeds N).
- **Decision tables** — enumerate combinations of conditions → expected outcome (e.g.
  step-kind × answer-validity → advance enabled/blocked; required vs optional × answered vs blank);
  one case per distinct rule, collapse don't-care rows.
- **Cause-effect graphing** — when several inputs jointly drive one output, map causes→
  effects to find the combinations that actually change behaviour (feeds the decision table).
- **State transition testing** — model the flow as engine states and legal/illegal transitions and cover
  each transition (e.g. `entry → step → step → complete`; `step → back → prior step` restores a valid
  state; advancing without a valid answer is a no-op / stays on the step; `complete` is terminal). Cover
  at least one invalid transition.
- **Pairwise / combinatorial** — when factors interact (step-kind × required-flag × back-then-forward),
  cover all pairs rather than the full cross-product to keep cases bounded.
- **Classification trees** — when an input has nested sub-classes, branch them and pick a
  representative leaf per branch (e.g. email in a free-text step: missing @, missing domain, missing TLD,
  internal space, double @ — each a leaf).
- **Use-case / scenario testing** — walk the primary end-to-end flow as cases (entry loads → generic
  traversal to completion → outcome oracle confirms account + booking).
- **Domain analysis** — for interacting numeric/range inputs, test on/off/in/out points of
  each domain boundary together (e.g. age-range boundaries vs downstream acceptance).

**Experience-based (catch what the spec misses):**
- **Error guessing** — target likely-broken spots: an unanswerable step, a step with zero enabled
  options, double-clicking advance (double-submit), a stale progress bar, a step the engine can't
  classify, network blip mid-flow.
- **Exploratory** — note behaviours the live quiz reveals that the requirement omitted;
  turn each surprise into a case (and flag the requirement gap). Do NOT turn variant *content* into a
  case — that's tier 3.
- **Checklist-based** — sweep the standard concern list (the sections above) so no whole
  category is forgotten.

**Structural completeness (don't leave a hole):**
- **Full happy path** — entry → traversal → completion → outcome, end to end, as the load-bearing case.
- **All step kinds & transitions** — every step *kind* the engine can meet, and every engine transition
  (advance, back, complete, blocked-advance).
- **All invariants** — one advance affordance per step; progress advances; no dead-end; back works; no
  console errors; no 4xx/5xx on the happy path — each is its own case.

**Non-functional lenses (juniors forget these — prompt EACH one explicitly):**
- **Security** — stored/reflected XSS in every free-text step (script treated as literal, no execution);
  no sensitive data in URL/query on navigation; injection strings accepted as literal (no 500). **Never**
  automate CAPTCHA/bot-detection bypass (→ Deferred).
- **Accessibility** — keyboard operability of each step (Tab/Enter/Space to answer + advance), focus
  moves to the new step on advance, options have accessible names/roles, ARIA state on selected options.
- **Performance / responsiveness** — first navigation to stage may be slow (real wait, no thrash);
  traversal completes within a sane time/step budget; no freeze on advance.
- **Localization / i18n** — the funnel is under `/uk/`; Unicode/Cyrillic/RTL input in a free-text step
  round-trips without mojibake. (Do NOT assert that copy is translated — that's tier-3 content.)
- **Compatibility** — viewport widths (mobile paid traffic!), no horizontal-overflow of the document,
  cold deep-link to the entry route.
- **Usability** — a blocked advance gives a clear reason; sensible defaults; the success surface is
  reachable and identifiable by a stable signal (not by its copy).
- **Data integrity & persistence** — the created account + booking are real and queryable via the API
  oracle after completion (re-fetch from the backend, not client state).
- **Concurrency / race** — double-clicking advance creates ONE progression / ONE account, not two;
  out-of-order async on a step settles on the final valid state.
- **Large / empty edge sets** — a step the engine cannot classify (unknown kind) fails loudly, not
  silently; a step with no enabled advance is reported as a dead-end (invariant breach), not a hang.
- **Error handling & recovery** — a backend 5xx / dropped network mid-flow surfaces an error (not an
  infinite spinner or blank), and the failed outcome is asserted honestly (no masking).

For the dynamic Charlie quiz surface specifically, the technique grid maps onto:
- **Step kinds** (equivalence classes, not named steps): single-choice, multi-choice, free-text, date/
  numeric, and info/continue-only — one representative case per kind for "detect it + answer it validly +
  advance", derived from the generic engine, never from a variant's specific step.
- **Structural invariants** (deterministic tier): exactly **one** primary advance affordance per step;
  answering + advancing **increases progress**; **no dead-end** (every reached step is advanceable or is
  completion); **back** returns to a valid prior step; **no console errors** and **no failed 4xx/5xx
  requests** on the happy path — each an atomic case.
- **Generic traversal** (heuristic tier): `runToCompletion` reaches the end on **any** variant within a
  bounded step budget; `detectStep` classifies every kind it meets (unknown kind → explicit failure);
  `answerCurrentStep` yields a valid answer for each kind. The oracle is *reached completion*, not content.
- **The outcome oracle** (deterministic tier, the crown jewel): after completion, **account created +
  trial booked**, asserted via the most stable signal available — API query of the created user + booking
  (best) > network-response intercept of the create/booking 2xx (fallback) > a stable success-surface
  test-id/role (last resort). Never assert the success screen's wording.
- **Side-effects & data hygiene** (guardrail-driven cases): completion is a REAL mutation — cases use a
  synthetic tagged lead (`quizLead(prefix)`), stay minimal/rate-limited, prefer re-querying the API oracle
  over re-running the full flow, and NEVER involve real payment/credentials or solving a CAPTCHA.

## Process — follow in order

1. **Scope it.** State the feature/flow/requirement in one line and what's explicitly
   out of scope (payment/OTP, and all tier-3 content — copy/step-count/order/variant). Pick the
   3-letter focus code (`QZ` for the quiz).
2. **Inventory the real surface.** Sources in priority order: the user's description →
   any written requirement (the `test-design/<area>/REQUIREMENTS.md` from `/analyze-requirements`) → the
   **live quiz via the `playwright` MCP** (public, no auth; exploration is **read-only** — study the
   step anatomy, step backward/forward, **never complete the funnel just to look**). List every
   **invariant**, every **step kind** you observe, the generic-engine states/transitions, the advance
   affordance shape, the free-text/date inputs, the success/booking signal, and the outcome-oracle path
   (API/network/surface). Do NOT inventory specific step copy or the step count as things to assert —
   they are variant-bound. If a requirement exists, enumerate every acceptance criterion. **Flag any
   ambiguity or gap** for the summary — do not silently guess.
3. **Apply the technique grid per element.** For each inventory item (invariant / step-kind / engine
   state / input / action), walk the grid above and jot candidate cases, tagging each with its tier.
   Be generous here — divergence before convergence.
4. **Derive cases.** Turn each surviving candidate into a line that meets the quality bar
   (atomic, observable, expected result stated, variant-independent, automation-ready).
5. **DEDUPE.** Remove or merge any two cases that would pass/fail for the same reason or
   assert the same behaviour through a different control. This is mandatory, not optional.
6. **Prioritize by risk.** Assign critical/high/medium/low per the legend, using impact ×
   likelihood. The **funnel-completion + outcome-oracle** case is **critical**; invariants and generic
   traversal trend high; security and data-integrity cases trend critical/high. **Tag the
   critical/high core-funnel cases as `@smoke`** — `@smoke` is the load-bearing CI grep filter (the
   `/run` smoke lane), so assign it deliberately, not by chance. The completion + outcome case is the
   canonical `@smoke` case.
7. **Assign `<FOC>-NNN` ids.** Number sequentially across the whole file; continue any
   existing numbering for this area — never reuse issued ids.
8. **Write the checklist to `test-design/<area>/CHECKLIST.md`** (create the `<area>` folder if absent;
   `<area>` matches the `tests/web/<area>/` name — `quiz`), in the exact format above (header block →
   `##` sections → cases → `## Do not automate` → `## Deferred`). Drop any redundant `<AREA>_` filename
   prefix — the folder names the area. It is a shared artifact — **commit it via `/open-pr` (`docs:`)** so
   the team and the REQ→case→test traceability chain work from the same source.
9. **Do-not-automate & Deferred sections.** Put all tier-3 content (copy, step count/order, which
   variant, visuals) under `## Do not automate — A/B-variable content` with the reason. Put every
   forbidden/destructive case (solving a CAPTCHA, entering real payment/credentials, anything that
   pollutes product analytics beyond a single synthetic run) under `## Deferred — do not implement` with
   a one-line reason. Never drop either silently; never hand them to `/test-write`.
10. **Summarize & hand off.** Report counts by priority, the total, which case is the `@smoke` funnel
    check, and every requirement gap / ambiguity you flagged. Then **offer the next step** via
    `AskUserQuestion` (CLAUDE.md Interaction model), don't auto-proceed: *[▶ capture locators with
    `/analyze-page`] [▶ automate the funnel case with `/test-write`] [⏸ stop]*.

## Guardrails (from CLAUDE.md — never violate)

- **Read-only on the live quiz.** Explore via the `playwright` MCP only; **completing the quiz is a REAL
  mutation** (creates a user + trial on live stage) — never run it just to "see what happens". Study the
  step anatomy backward/forward without submitting the final booking.
- **Never bypass or solve CAPTCHA / bot-detection**, and **never enter real payment/card/credential
  data** — such cases go to Deferred, never into the implementable checklist.
- **Don't design against A/B-variable content.** Exact copy, step count/order, which variant, and visual
  layout go under `## Do not automate` — asserting them is a guaranteed false-failure factory (tier 3).
- **Synthetic data only.** Any case that reaches completion uses a synthetic tagged lead
  (`quizLead(prefix)`), stays minimal/rate-limited, and prefers the API oracle over re-running the flow.
- This skill produces a **checklist, not code.** It does not write tests or open PRs —
  that is `/test-write`.
