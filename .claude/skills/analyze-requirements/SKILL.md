---
name: analyze-requirements
description: Turn business requirements — a stated spec (pasted Jira ticket, doc/text file, prose) OR a missing/weak one you must DERIVE from the live quiz + domain — into a clean, atomic, TESTABLE, ID'd requirements artifact that /test-design consumes. Read the source critically, extract explicit AND implicit/non-functional requirements, audit each against the ISO/IEC/IEEE 29148 quality characteristics (keystone: Verifiable — acceptance criteria mandatory), resolve every ambiguity by asking or flagging an assumption (never silently invent), and write test-design/<area>/REQUIREMENTS.md with REQ-IDs + acceptance criteria + traceability. Use when asked to analyze/clarify/refine/intake requirements, a ticket, a spec, or acceptance criteria — including when there is no spec and you must recover requirements from the live quiz. The step BEFORE /test-design — produces REQUIREMENTS ONLY, no test cases, no automation.
model: claude-opus-4-8
effort: high
---

# Analyze requirements (requirements intake)

The **first** phase of the QA pipeline, upstream of everything: business input becomes a
clean, atomic, **testable** requirements artifact. `/test-design` reads that artifact to
build the `<FOC>-NNN` checklist; every downstream test case traces back to a **REQ-ID**
here. Garbage requirements produce garbage coverage — this layer is the gate.

You act as the **requirements engineer / business analyst**: read critically, find what's
missing as hard as what's stated, audit against a recognized standard, and refuse to let
ambiguity through silently. The bar is **ISO/IEC/IEEE 29148** (the requirements-engineering
standard), and for AQA the keystone characteristic is **Verifiable** — *no acceptance
criteria => not yet a requirement.*

Output is a single markdown file at **`test-design/<area>/REQUIREMENTS.md`** — the project's home for
design artifacts, one folder per area mirroring `tests/web/<area>/` (`quiz`, …); never
the repo root and never `lib/`. This skill is self-contained:
quality characteristics, audit, REQ format, and process are all below.

## The one thing that reshapes requirements here: the quiz is NOT static
Charlie is the paid-traffic sign-up quiz, and it **changes weekly and runs several A/B tests at once** —
steps, texts, order, and the set of screens differ between users and week to week. So requirements are
written by **stability tier**, and this shapes what is even *allowed* to be a requirement:

- **Deterministic (the real requirements)** — the **invariants true in every variant** (entry loads; each
  step has exactly one primary advance affordance; answering + advancing moves progress forward; no
  dead-ends; no console errors / no failed 4xx-5xx on the happy path) **plus the business OUTCOME**
  (account created + trial booked). These are stable and belong in `REQUIREMENTS.md`.
- **AI-agent / heuristic (a navigation requirement, not a content one)** — that the flow can be driven
  generically ("read whatever step is on screen, pick a valid answer, advance") until completion. The
  requirement is *reach the end*, not *step N says X*.
- **Don't fix at all (NON-requirements — out of scope)** — exact copy/wording, the number/order of steps,
  which A/B variant was served, visual layout, option labels. **Never canonize these as requirements.**
  Writing "step 3 asks the child's age" as a requirement guarantees perpetual false failures. At most they
  are an **informational drift snapshot** that never fails the build — call that out as out-of-scope, don't
  turn it into a `REQ-`.

The oracle for **Verifiable** is therefore almost always the **outcome** — account created + trial booked —
checkable via **API > network-response intercept > a stable success surface** (never localized success copy).

## Input — TWO source modes (most features are a MIX)

A requirement here is the *answer to "what must be true"*, not "how we'd check it in the
UI". Keep acceptance criteria observable but tool-agnostic. The source comes in two modes:

- **Source A — a stated spec** (current behaviour, textual): pasted prose, a file path
  (Read it), or a pasted Jira ticket. There is **no Jira MCP** — the user pastes / gives a
  path; you read it, you don't fetch it. Theory-heavy, no app interaction.
- **Source B — no / weak / missing spec → DERIVE** ("requirements recovery", testing
  without a spec). **The common reality for Charlie:** there is no formal spec, the quiz is
  A/B-variant and changes weekly, so "the spec" is really the **stable contract** you recover
  from the live flow + domain, not a document. The source becomes the **live quiz behaviour**
  + **domain conventions** + **the user as context holder** — see the Source B section below.

**Mixed reality is the norm.** Most features are PARTIAL spec: a stated outcome ("completing the
quiz creates an account and books a trial"), everything else derived. Apply Source-A rigor to the
stated parts and the Source-B discipline (oracles, coverage heuristics, `derived` status) to the
recovered parts.

## Scope — what this skill does and does NOT do

- **Produces REQUIREMENTS ONLY** — refined, atomic, acceptance-criteria'd, ID'd needs.
- **NOT test cases** (`<FOC>-NNN` cases are `/test-design`), NOT locators/methods/tests.
- Source A does **not** touch the app. Source B reads the quiz **only to observe behaviour**
  (via `/analyze-page` / the Playwright MCP) — **read-only, never mutating** (completing the
  quiz creates a real user + trial on live stage), never writing `lib/`.

## The quality bar — ISO/IEC/IEEE 29148 characteristics

Audit **every** requirement against these seven. For each defect, name the characteristic
it violates and why. The AQA keystone is **Verifiable** — enforce it hardest.

1. **Necessary** — traces to a genuine business need; no gold-plating / scope creep. *Tell:*
   a "requirement" no stakeholder asked for, or that restates A/B-variable UI content (a step's
   copy, its option labels) as a need.
2. **Unambiguous / Clear** — exactly one interpretation. *Tell:* weasel words — "fast",
   "user-friendly", "intuitive", "robust", "should be able to", "support", "handle",
   "appropriate", "as needed", "etc." Each must be replaced with a measurable bound.
3. **Complete** — states inputs, outputs, **and** error / edge / negative behaviour. *Tell:*
   happy-path only; "TBD"; a trailing "etc." standing in for unenumerated cases.
4. **Singular / Atomic** — one requirement = one need. *Tell:* "and" / "or" / a comma list
   bundling behaviours ("creates the account **and** books the trial" — that's two outcomes,
   split them). Split them.
5. **Consistent** — no contradiction with any other requirement in the set. *Tell:* two
   reqs giving different limits/defaults/outcomes for the same condition.
6. **Feasible** — implementable and *observable* within the app and tech constraints. *Tell:*
   assumes a capability the product/stack doesn't have, or conflicts with a known guardrail
   (e.g. requires solving a CAPTCHA, or pins a specific A/B variant we don't control).
7. **Verifiable / Testable** *(keystone)* — an objective pass/fail check exists; the req
   carries explicit **acceptance criteria**. *Tell:* no criteria, or criteria that aren't
   observable ("the quiz feels smooth", "the right steps show"). For Charlie the verifiable
   anchor is usually the **outcome oracle** (user + booking) or a structural invariant, **not**
   variant content. **Missing acceptance criteria => it is not yet a requirement — resolve
   before it ships from this skill.**

**Set-level audit** (the whole artifact, not just each line):
- **Complete (as a set)** — no gap in the feature: entry, the structural invariants, the
  outcome, and the negative/blocked paths all have at least one requirement.
- **Consistent (as a set)** — no two requirements conflict.
- **Non-redundant** — no two requirements state the same need; merge duplicates.

## Extract EVERYTHING — the classic failure is losing the implicit / NFR ones

Pull out, explicitly:
- **Explicit** requirements — what the source states outright.
- **Implicit** requirements — what the business assumes but didn't write (e.g. "completing the
  quiz creates an account" implies **exactly one** account + **one** trial booking per completion,
  and that the created lead is **persisted** and queryable; "self-seed a lead" implies **unique,
  tagged** synthetic emails so runs don't collide).
- **Functional** — behaviour, inputs → outputs, state transitions, the end-to-end flow and its outcome.
- **Non-functional** — the ones juniors drop. Sweep each lens explicitly:
  **validation** (answer format/required per step, free-text/date bounds),
  **security** (no PII/credentials in URLs, injection/XSS in free-text treated as literal),
  **persistence/data integrity** (the created user + booking survive and are queryable),
  **performance/responsiveness** (entry loads within a bound; step transitions don't hang —
  bounded so a looping variant fails loudly), **accessibility** (each step's primary advance
  control and options are reachable by role), **i18n/localization** (locale in the route, e.g.
  `/uk/…`; content itself is out-of-scope "don't fix"), **error handling & recovery** (no
  dead-end step; a failed submit surfaces, doesn't silently strand), **concurrency** (parallel
  synthetic runs don't collide), **empty/large data**, and the **health invariants** (no console
  errors, no failed 4xx/5xx requests on the happy path).

If the source is silent on a lens that the feature plainly needs, that is a **gap** — do
not invent the answer; ask, flag an assumption, or (Source B) derive it as `derived`.

## Source B — deriving requirements without a spec

When there is no / a weak spec (the Charlie default), the requirement source shifts to three
things: the **live quiz behaviour** (observe via `/analyze-page` / the Playwright MCP,
**read-only** — never complete the flow just to look), the **domain conventions** (the sign-up
funnel's structure and standard validation / persistence / health norms), and **the user** as
the context holder (ask when judgment is needed). Output is still `REQ-<AREA>-NNN` + acceptance
criteria — but with two disciplines that Source A doesn't need:

**The oracle problem (the keystone caveat).** With no spec, codifying "what the quiz does"
makes tests pass by construction and **blind to a wrong-but-shipped behaviour**.
**As-built != as-intended.** This bites twice as hard here because much of what you *observe* is
A/B-variable and must NOT become a requirement at all. Therefore:

- **Do not canonize observed behaviour as a confirmed requirement.** Judge correctness with
  **heuristic test oracles** — *consistency oracles*: a behaviour is suspect if it's
  inconsistent with its **History**, the product's own **internal consistency**, **Comparable**
  products, the **Claims / UI text**, reasonable **User** expectations, the feature's
  **Purpose** (a paid sign-up funnel exists to create an account + booking), or **Standards /
  familiar conventions**. When observed behaviour conflicts with a consistency oracle, raise it
  as an **open question / suspected defect** — **NOT** as a requirement.
- **Separate invariant from variant.** Before writing a `REQ-`, ask "is this true in *every*
  variant?" If it depends on which A/B arm you happened to see (this step, this copy, this
  order, this step count), it is the **"don't fix" tier** — out of scope, at most a drift note,
  never a requirement.
- **Be complete without a requirement list** via **coverage heuristics**, so derivation
  isn't just the one variant you happened to see:
  - **Product-element sweep** — walk every facet: **Structure** (the entry, the generic step
    anatomy — one primary advance affordance + the step's answer controls, the success/booking
    surface), **Function** (drive to completion + each negative/error path: dead-end, failed
    submit), **Data** (the synthetic lead in, the created user + booking out, boundary answers),
    **Interfaces** (the browser UI + the create/booking API/network calls), **Platform** (a
    **public no-auth funnel** in a browser, **multiple concurrent A/B variants**, **real
    side-effects on live stage** — a completion creates a real user + trial), **Operations**
    (the real paid-traffic workflow: land on entry → answer → complete), **Time** (step-transition
    progress, no hang/loop — bounded, and the created entities persist/are queryable after).
  - **Outcome × path × state** — for the one entity the funnel produces (the lead → account +
    trial), ask what a completion, an abandonment, and a blocked path *should* do — **including
    the forbidden ones** (a completion must create **exactly one** account + **one** booking, not
    duplicates; an incomplete run must create **none**; a rejected/duplicate/locked lead is
    refused). This is what turns one observed happy path into a full grid of derived requirements
    without pinning any variant content.
- **Every Source-B requirement gets status `derived`** — "inferred from the live quiz/domain, not
  confirmed by the business — validate before relying on it." List the **load-bearing**
  derived requirements in Open Questions for business validation.

**Tie-ins (don't duplicate those skills):** Source B leans on `/analyze-page` for real
behaviour and on the `/test-design` technique grid + domain reasoning for coverage; the
user is asked when judgment is needed.

## Resolving gaps & ambiguity — ask OR flag, NEVER silently invent

For every defect, gap, or ambiguity, choose exactly one:
- **(a) Ask** — a sharp, specific clarifying question with options where possible. Not
  "what about validation?" but "On a completion, is the success signal a create/booking API
  response we can intercept, a stable test-id on the confirmation screen, or an entity we query
  via `apiClient`? (Determines the outcome oracle.)"
- **(b) Assume** — record an **explicit, flagged ASSUMPTION** so `/test-design` and the
  team can validate it. Mark the requirement's status `assumed` and list it in the Open
  Questions section.
- **(c) Derive** (Source B only) — recover the requirement from quiz + domain, mark it
  `derived`, and list the load-bearing ones for business validation.

**Never** paper over a gap by quietly writing a plausible-sounding requirement as `clear`.
A silent invention is the worst failure of this layer: it looks like a confirmed need and
gets tested as one. When in doubt, flag it.

## REQ-IDs — `REQ-<AREA>-NNN`

Stable id per area: `REQ-` + the **uppercase area code** (reuse the same focus code the
downstream checklist will use — Quiz → `QZ`) + zero-padded **sequential** number:
`REQ-QZ-001`, `REQ-QZ-002`, …

- One area per artifact; number globally across the file in appearance order.
- **Continue existing numbering** — if `test-design/<area>/REQUIREMENTS.md` already exists, start at
  the next integer; never reuse or renumber an issued id. Downstream `<FOC>-NNN` cases cite
  these ids in their traceability, so they must be stable.

## Output format — `REQUIREMENTS.md` (exact)

```
# <Area> — Requirements

**Source(s):** <ticket id / file path / "pasted prose, 2026-07-21" / "derived: live quiz + domain"> — record every source for traceability.
**Scope:** <one line: the feature this artifact covers>.
**Out of scope:** <what the source mentions but this artifact excludes — ALWAYS list the "don't fix" tier here: exact copy/wording, step count/order, which A/B variant, visual layout, option labels>.

**Status legend:** `clear` = unambiguous & confirmed · `assumed` = filled by a flagged
assumption (validate before test-design) · `derived` = inferred from the live quiz/domain, not
confirmed by the business (Source B — validate before relying on it) · `needs-clarification`
= blocked on an open question.

**Standard:** audited against ISO/IEC/IEEE 29148 (Necessary, Unambiguous, Complete,
Singular, Consistent, Feasible, Verifiable + set-level completeness/consistency/non-redundancy).

---

## <Section — e.g. Completion outcome>

### REQ-QZ-001 — <one-sentence requirement statement>
- **Type:** functional | validation | security | permissions | a11y | persistence | i18n | performance | error-handling
- **Priority:** critical | high | medium | low
- **Acceptance criteria:**
  - Given <precondition>, When <action>, Then <objectively observable outcome — prefer the outcome oracle or a structural invariant, never variant content>.
  - <additional objective condition / negative case>.
- **Source:** <ticket §/line / file / "implicit — assumed" / "derived — observed in live quiz + domain norm">
- **Status:** clear | assumed | derived | needs-clarification

### REQ-QZ-002 — …

## Open questions & assumptions

**Open questions (blocking — answer before /test-design):**
- Q1 (REQ-QZ-00X): <sharp, specific question + options>.

**Suspected defects (Source B — observed behaviour conflicts a consistency oracle):**
- D1 (REQ-QZ-00Z): <observed behaviour, which oracle it fails, why suspect>.

**Assumptions (flagged — validate):**
- A1 (REQ-QZ-00Y): <the assumption made, why, and what it would change if wrong>.

**Derived requirements to validate with the business (Source B — load-bearing):**
- V1 (REQ-QZ-00W): <the derived need + what relies on it being correct>.

## Traceability

| REQ-ID | Source | Status |
|--------|--------|--------|
| REQ-QZ-001 | ticket §2.1 | clear |
| REQ-QZ-002 | implicit (persistence) | assumed |
| REQ-QZ-003 | derived (live quiz + domain norm) | derived |
```

Rules:
- Group reqs into `## <Section>` blocks by concern; **ids stay globally sequential** across
  sections.
- **Every** requirement carries acceptance criteria — a req with none is `needs-clarification`,
  not `clear`.
- The **Out of scope** line must explicitly name the **"don't fix" tier** (copy, step
  order/count, A/B variant, visuals) so no downstream layer mistakes them for needs.
- The **Open questions & assumptions** and **Traceability** sections are **mandatory**.
  Include the suspected-defects / derived-to-validate blocks whenever Source B is in play.

### Compact example (one real entry)

```
### REQ-QZ-007 — Completing the quiz must create exactly one account and one trial booking for the lead.
- **Type:** functional
- **Priority:** critical
- **Acceptance criteria:**
  - Given a fresh synthetic lead from quizLead(prefix), When the flow is driven to completion, Then exactly one account exists for that email (queried via apiClient / the create response is a single 2xx).
  - Given the same completion, Then exactly one trial booking exists for that account — no duplicates.
- **Source:** ticket §3 ("completion signs the user up + books a trial") + implicit (exactly-once, no duplicates)
- **Status:** clear
```

### Compact example — Source B `derived` (no spec)

```
### REQ-QZ-014 — A quiz run abandoned before completion must create no account and no booking.
- **Type:** persistence
- **Priority:** high
- **Acceptance criteria:**
  - Given a synthetic lead, When the flow is entered and answered part-way but not completed, Then no account and no trial booking exist for that email (queried via apiClient).
- **Source:** derived — funnel Purpose oracle (only a completion is a conversion) + domain norm; no create/booking call fires before the terminal step.
- **Status:** derived
```

## Process — follow in order

1. **Ingest & classify the source.** Decide the mode: **Source A** (stated spec — accept
   pasted prose, a file path you Read, or a pasted ticket) or **Source B** (no/weak spec →
   derive — the Charlie default). Most features are a **mix**. **Record every source** for
   traceability (mandatory).
2. **If no/weak spec → derive via Source B.** Observe live behaviour (`/analyze-page` /
   Playwright MCP, **read-only — never complete the flow just to look**) + apply domain
   conventions; sweep the coverage heuristics (product elements + outcome × path × state) so
   derivation isn't just the one variant you saw. Separate invariant from A/B-variable content.
   Ask the user where judgment is needed.
3. **Extract everything.** Explicit **and** implicit; functional **and** non-functional —
   sweep every NFR lens above. Losing the implicit/NFR requirements is the classic failure.
4. **Audit each against the 7** (+ the set-level checks). Name the characteristic and why
   ("ambiguous: 'the right steps show' has no measurable bound"; "not verifiable: no acceptance
   criteria"; "bundled: split account-created from trial-booked"; "not necessary: restates
   variant copy — that's the don't-fix tier, move to Out of scope"; "redundant with REQ-x").
   For Source-B items, also run the **consistency oracles** — when observed behaviour conflicts
   an oracle, log a **suspected defect**, do not canonize it as a requirement.
5. **Resolve every gap.** For each: **ask** a sharp question, record a **flagged assumption**,
   or (Source B) **derive**. Never silently invent. Mark status accordingly.
6. **Reformulate.** Rewrite into clean, atomic, testable requirements — each with a
   REQ-ID, one-sentence statement, **acceptance criteria** (Given/When/Then or objective
   conditions including the negative/error case — anchored on the outcome oracle or an
   invariant, never variant content), type, priority, source, status.
7. **Write `test-design/<area>/REQUIREMENTS.md`** (create the `<area>` folder if absent; `<area>` matches
   the `tests/web/<area>/` name — e.g. `quiz`; drop any redundant `<AREA>_` filename prefix), in the exact
   format above, including the **Out of scope** "don't fix" line and the **Open questions & assumptions**
   and **Traceability** sections. It is a shared artifact — **commit it via `/open-pr` (`docs:`)** so
   `/test-design` and the team work from the same source.
8. **Summarize & hand off.** Report counts by status (clear / assumed / derived /
   needs-clarification) and by priority, list every open question, suspected defect, and
   load-bearing `derived` requirement up front. If there are blocking open questions, surface them
   **before** handoff. Then **offer the next step** via `AskUserQuestion` (CLAUDE.md Interaction
   model), don't auto-proceed: *[▶ proceed to `/test-design`] [✏ resolve open questions first] [⏸ stop]*.

## Guardrails (never violate)

- **Requirements only** — no test cases (that's `/test-design`), no automation, no
  locators/methods/tests. Source B quiz reads are **read-only** observation; **completing the
  quiz is a real mutation** (creates a real user + trial on live stage) — never do it here.
- **Never canonize A/B-variable content as a requirement** — exact copy, step order/count,
  which variant, visuals are the **"don't fix" tier**: Out of scope, at most a drift note.
- **Never silently invent** a requirement — every gap or ambiguity is an open **question**,
  a flagged **assumption**, or a Source-B **`derived`** item; never a quiet `clear`.
- **As-built != as-intended** — never canonize observed behaviour as `clear`. Source-B
  needs are `derived` until the business confirms them; oracle conflicts are suspected defects.
- **Traceability is mandatory** — every refined REQ links to its source (or is marked
  `implicit` / `derived`), so a downstream `<FOC>-NNN` case can trace back through REQ-ID to origin.
- **No requirement ships `clear` without acceptance criteria** — missing criteria means
  `needs-clarification`, not done. (Derived requirements still carry acceptance criteria,
  but ship as `derived`, never `clear`, until the business confirms.)
