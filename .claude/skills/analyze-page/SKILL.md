---
name: analyze-page
description: Analyze the live Charlie sign-up quiz via the Playwright MCP and WRITE its verified LOCATOR layer into lib/pages/quiz.page.ts — derive content-agnostic, role/shape-based locators from the real step anatomy, confirm each matches exactly one element, then commit them as private fields + factories (scaffolding class + mixin + WebClient + AppRoute when the object is new). Writes LOCATORS ONLY — no @step methods (that's /sdk-builder), no tests (that's /test-write). Use when asked to analyze/map/read the quiz, capture or build selectors, or stand up the QuizFlow object's locators before building methods.
model: claude-sonnet-4-6
effort: medium
---

# Analyze the live quiz → write its LOCATOR layer

The precision-critical SELECTOR phase. Read the real quiz through the **playwright** MCP, derive
**robust, verified, content-agnostic** locators, and write them as the **locator layer** of
`lib/pages/quiz.page.ts` (private fields + factories; class + wiring if the object is new). Bad
selectors poison every downstream test, so the discipline is **snapshot → enumerate → derive → verify →
SWEEP → write, ONCE** — no guessed CSS, no trial-and-error loops against the live app.

**The quiz is DYNAMIC.** Steps, texts, order, and the set of screens vary between users and week to week
(several A/B tests run at once). So the locators you write must key on **role / shape / structure, NEVER
on option text or copy** — those break across variants. This is the single biggest difference from a
static admin page: you are mapping a **generic step anatomy**, not a fixed set of named screens.

**Hard boundary — you write LOCATORS only.**
- THIS skill (selector layer): private locator fields + factories + (for a new object) class scaffold,
  mixin, `WebClient` composition, `AppRoute`. Nothing else.
- `/sdk-builder` (method layer): owns the `@step` act-and-return methods (the generic step engine +
  oracle) built on these locators.
- `/test-write` (test layer): owns the specs.
Leave a placeholder comment where methods will go. **Do NOT write `@step` methods. Do NOT write tests.**
If you feel the urge to add behavior, stop — wrong layer. When done, hand off to `/sdk-builder`.

Project rules in `CLAUDE.md` always apply. Lean on the shared docs; do not re-derive their detail:
- `.claude/docs/playwright-guide.md` — extraction protocol, locator philosophy, the **content-agnostic A/B rule**, encapsulation.
- `.claude/docs/code-style-guide.md` — the **light `QuizFlow`** POM shape / fixtures / SOLID / `@step` (so locators land in the right shape).
- `.claude/docs/git-ci-guide.md` — branch + PR flow for landing the code.

---

## The locator priority ladder — the HEART of this skill

Every locator is one decision: **walk this ladder top-down and commit the HIGHEST tier that uniquely +
stably identifies the element.** Never drop a tier when a higher one works — not to CSS when a
`getByRole` resolves, not to XPath when a scoped CSS resolves. The tier you used is reported per element.

### Tier 1 — Playwright built-in, user-first locators (STRONGLY PREFER)
`getByRole(role, { name })` · `getByLabel` · `getByPlaceholder` · `getByText` · `getByAltText` ·
`getByTitle` · `getByTestId`.
**Why first:** they target the element the way a user and assistive tech perceive it (role + accessible
name), so they survive DOM restructures, class-hash churn, and CSS refactors. This is Playwright's
official recommendation. `getByTestId` is the **preferred anchor for contract-level handles** (entry,
the primary advance control, the outcome/success surface) because a stable test-id survives A/B copy
changes. **For the variable middle, use role/shape only — do NOT anchor on the accessible NAME when the
name is option copy or a localized label** (see the content-agnostic rule below).

### Tier 2 — stable CSS (only when Tier 1 can't uniquely + robustly reach it)
Stable **structural** attributes and prefix partials, tightly scoped to a stable parent:
- Prefer stable `data-*` / structural hooks the quiz exposes (`[data-testid]`, `[data-step]`, `role`
  containers) — check for these first via `browser_evaluate`.
- Auto-generated / hashed CSS-module classes are **rebuild- AND variant-volatile** → never the raw
  literal; if you must, use a `[class*="StablePrefix"]` partial on a human-authored prefix, scoped to its
  container — but treat this as a smell on a dynamic quiz.

### Tier 3 — XPath (LAST resort)
Relative XPath only, anchored to a nearby stable node, when neither role nor CSS can express the
relationship (e.g. "the input that follows this label"). Reach here almost never. **Never absolute XPath.**

### Per-element rule
Highest tier that is **unique + stable** wins. Tier 1 by default; descend only when the page genuinely
offers no clean accessible handle. Do not assume any UI framework — read the real DOM and take whatever
stable, content-agnostic handle it actually offers.

### The content-agnostic rule — the A/B guardrail (specific to this quiz)
Because steps, texts, and options differ per variant and per week, **generic-engine locators key on
role/shape/structure, never on content:**
- "the primary advance control on the current step" → the single enabled submit/continue button **by
  role, scoped to the active step container** — **not** `getByRole("button", { name: "Continue" })`
  (copy is variant/locale-bound).
- "the selectable options of the current step" → a **factory** returning option controls by role
  (`radio` / `checkbox` / option-role), verified on a real sample — **not** matched by option label.
- Free-text input / date input → by role/type, scoped to the active step.
- **Contract-level, stable screens (entry, primary advance control, success/booking) MAY use a
  `getByTestId`/role handle** keyed on a stable attribute — these don't move between variants. Everything
  in the variable middle stays content-agnostic.

### BANNED — these are not locators, they are future flakes (ban + the fix)
- **Localized / volatile option text or step copy as the SOLE anchor** → this is the #1 A/B flake source;
  anchor on role/shape/structure scoped to the active step, never on the label a variant happens to show.
- `nth-child` / `:nth-of-type` / any positional chain → scope to a stable parent and match by role/shape instead.
- Long brittle descendant chains (`div > div > span > …`) → anchor on the nearest stable container.
- Raw fully-hashed class literals (change per build *and* per variant) → use a `[class*=]` partial on the
  stable, human-authored prefix, scoped — or find a `data-*`/role handle instead.
- Absolute XPath (`/html/body/...`) → relative XPath off a stable node, or climb the ladder back to CSS/role.
- Blind `.first()` / `.nth()` to paper over a non-unique match → fix the locator (scope / shape / anchor).
  (A shape-based option **factory** taking an index is fine — that's parameterization, not papering over.)

---

## Completeness & attentiveness — miss NOTHING (highest-priority dimension)

This team judges this skill on **coverage** — but coverage here means the **generic step anatomy**, not
"every screen the quiz can ever show" (you can't enumerate an A/B space). A silently dropped structural
part (e.g. the back control, the validation anchor) is a worse failure than an imperfect tier choice.
Work in two passes, then prove you missed nothing.

**Pass 1 — enumerate.** From the snapshot, list **every** structural region and **every** interactive or
observable element the current step exposes — mapped to the step-anatomy taxonomy below. Capture
state-bearing elements too (validation anchors, disabled/enabled advance, progress), not just the obvious
controls. Where a part only appears on *some* step kinds (date input, free-text input), step
backward/forward through a few screens to observe the variants (read-only — never submit the booking).

**Pass 2 — the COMPLETENESS SWEEP (self-critique).** Re-read the **full** `browser_snapshot` region by
region and ask: *"what interactive or observable part of the step anatomy — every state, every action —
did I NOT capture?"* Assume you missed something until the sweep proves otherwise. Hunt the classics
against the snapshot, not memory:

- the **single** primary advance/continue control vs any secondary controls (back, skip)
- the option **shape** on a multi-select step vs a single-select step (checkbox vs radio) — one factory that covers both by role
- free-text input and date input step kinds (may appear only on some steps — go find at least one)
- progress indicator / step counter; back control; skip control if present
- validation-**invalid** anchors / inline error text (which appears only after an invalid advance)
- disabled-vs-enabled **scope** of the advance control (present-but-disabled is still a locator)
- consent / cookie banner (may intercept on first load)
- the terminal **success / booking (outcome) surface** — the crown-jewel handle
- loading / spinner state between steps

**Not-present is explicit.** A part genuinely absent from the anatomy you observed gets a one-line
**"not present"** note in the report — **never** a silent drop. "I didn't see one" is not "there isn't
one"; only the sweep (across a few stepped screens) lets you say the latter, and the reviewer must see
you considered it.

---

## Quiz step-anatomy taxonomy — map the GENERIC shape, not named screens

The quiz is dynamic, so you do **not** map one region per named step. You map the **recurring anatomy**
that every step is built from, plus the two stable contract screens. A part you don't observe is simply
marked absent. Capture, as content-agnostic locators:

- **Entry screen** — the quiz start (`/uk/app/sign-up/long/charlie/age-range`). A **contract-level**
  handle: prefer `getByTestId`/role keyed on a stable attribute. This screen is stable enough to name.
- **Step container** — the generic wrapper for "whatever step is currently on screen". The scope root for
  every content-agnostic child locator below. Derive it structurally (a `data-step`/role container),
  never by the step's copy.
- **Primary advance / continue control** — the **SINGLE** affordance that moves the quiz forward on the
  current step. By role, scoped to the step container, keyed on being the enabled submit/continue — NOT on
  its label. This invariant ("exactly one advance affordance per step") is deterministic-tier.
- **Selectable OPTIONS** — the step's answer choices, as a **role/shape-based factory** (returns option
  controls by `radio` / `checkbox` / option-role, indexed or counted), **verified on a real sample step**.
  NEVER text-matched. One factory should cover single- and multi-select by keying on role.
- **Free-text input** — for steps that ask for typed input (name, email); by role/type, scoped to the step.
- **Date input** — for date-of-birth / date steps; by role/type, scoped to the step.
- **Progress indicator** — step counter / progress bar, if present (used to assert "progress moves forward").
- **Back control** — the backward-navigation affordance (analysis uses it read-only to observe variants).
- **Skip control** — an optional-step skip affordance, if the anatomy exposes one.
- **Validation / error anchors** — the inline invalid state that appears after an invalid advance attempt
  (structural anchor, not the localized message text). Flag it as a gap if reaching it needs a mutation.
- **Consent / cookie banner** — first-load interstitial that may intercept clicks; a stable structural handle.
- **Terminal success / booking (OUTCOME) surface** — the confirmation screen the flow lands on. A
  **contract-level** handle keyed on a **stable test-id/role**, never on localized success copy. This is
  the fallback signal for the outcome oracle (API/network preferred — that's `/sdk-builder`'s layer), so
  capture the most stable structural anchor you can, and do NOT complete the quiz to reach it (see Guardrails).

For **repeated** elements (options) write a private **locator factory** — a function that takes an
identifier (index) and returns a scoped, role-based locator — **verified against a REAL sample step**, not
a hand-written guess.

---

## Verify before you write — exactly ONE

Every locator is proven against the live DOM **before** it lands in the file. The bar is **strict-mode
clean: exactly one match** (for factories: the parameterized form resolves to one per identifier). The
deterministic loop is **derive → verify → write, once per element:**

1. **Derive** the candidate by walking the priority ladder **top-down** off the snapshot (role + shape
   first; accessible name only when it is NOT variant copy). For what the a11y tree can't expose — custom
   widgets, hashed classes — `browser_evaluate` the **real DOM/attributes**; check for `data-testid`/`data-*`
   first; never assume a class name.
2. **VERIFY it resolves to EXACTLY ONE element** (Playwright strict mode) — count matches via
   `browser_evaluate` or the snapshot's own uniqueness. Judge the count:
   - **1** → done, write it.
   - **0** → wrong handle. Re-derive (different role/shape, different scope) — do **not** loosen blindly.
   - **>1** → not unique. **Scope to the step container**, key on **shape/role**, or **anchor** it — then
     **re-verify**. **Never** resolve ambiguity with a blind `.first()`.
3. **Write** the locator into the file ONLY once verified. No retry loops, no unverified guessed CSS.

Repeated elements → a **factory**, verified on a **real sample** step pulled from the live quiz — record
which step you sampled. No locator is "done" on inspection alone; only on a clean resolve.

---

## Process

1. **Confirm the target & whether the object exists.** The target is the light **`QuizFlow`** object,
   `lib/pages/quiz.page.ts`, and the quiz entry route lives in `AppRoute` (`lib/pages/allright-app.ts`).
   Check `lib/pages/` for the existing page object (`quiz.page.ts`) / any component object
   (`components/*.component.ts`) and set the mode:
   - **EXISTING object** → **ADD only the new/missing private locators.** Do NOT touch its methods, its
     other locators, or any other section.
   - **NEW object** → **scaffold** the class + wire it in (§6b), then write its locators.
2. **Navigate + explore (READ-ONLY — no login exists).** `browser_navigate` to the entry route. **There
   is no auth** — the quiz is public paid-traffic; there is no login, no session, no password to type. You
   may step **backward and forward** through screens to observe the step-anatomy variants. Stage may
   cold-start on first load: wait, don't thrash. Strictly **read-only against the app** — snapshot, hover,
   read the DOM, and navigate between steps **WITHOUT submitting the final booking**. **NEVER complete the
   quiz** (that creates a real user + trial — a live mutation) and **NEVER solve a CAPTCHA / enter
   payment**. Decline non-essential cookies on the consent banner. (Writing the local `.page.ts` is
   expected; mutating stage is not.)
3. **Snapshot + enumerate the step anatomy (adapt the taxonomy).** `browser_snapshot` FIRST — the
   **accessibility tree** (roles + accessible names) is the source of truth and maps directly to
   `getByRole`/`getByLabel`. Map the **generic anatomy** of the current step (taxonomy above) — from the
   snapshot, not imagination — and step through a few screens to catch step-kind variants (options,
   free-text, date).
4. **Derive + VERIFY each locator.** Ladder top-down → resolve → **exactly one** before it's done (the
   verify-before-you-write loop above). Content-agnostic for the middle; `getByTestId`/role for the
   contract-level handles. Factory for options, verified on a real sample step.
5. **COMPLETENESS SWEEP.** Re-scan the full snapshot region by region; capture the stragglers; mark genuine
   absences **"not present"**. Treat anything you can't positively account for as a miss until the snapshot
   proves otherwise.
6. **WRITE the locator layer** into `lib/pages/quiz.page.ts`:
   - **6a. The locators (both modes).** **Private fields**, intent-named nouns (`stepContainer`,
     `advanceBtn`, `options`, `progress`) — never selector-named, never copy-named; grouped by anatomy part
     with a short comment banner per region; match the project's existing `*.page.ts` style
     (`private readonly`, scoped children). **Every locator is `private` — no exceptions.** Encapsulation
     is the contract: a test must **never** touch a selector; only the `@step` methods `/sdk-builder`
     builds on these locators expose behaviour. A locator you're tempted to make `public` is a design
     smell — the missing piece is a *method* (route it to `/sdk-builder`), never an exposed selector.
     Repeated/parameterized elements → a **private locator factory**, shape-based, verified on a REAL
     sample before writing, e.g.
     `private optionAt = (i: number) => this.stepContainer.getByRole("radio").nth(i);`
     (role/shape-based, NOT text-based).
     Top the block with a **verification banner** recording **what the locators were verified against and
     WHEN** (and which step kinds you sampled):
     ```ts
     // ════════════════════════════════════════════════════════════════════════
     // SELECTORS — verified against the live quiz (YYYY-MM-DD), sampled across
     // <N> step kinds. Middle-of-quiz locators are CONTENT-AGNOSTIC (role/shape,
     // scoped to the step container); only contract handles (entry, advance,
     // success) key on a stable test-id/role. NEVER anchor on option copy.
     // ════════════════════════════════════════════════════════════════════════
     ```
     **EXISTING object:** insert ONLY the new locators into the matching region (or add a new region banner).
     Touch nothing else — not its methods, not its existing fields.
   - **6b. Scaffold + wiring (NEW object ONLY).** The `QuizFlow` object is bound to the quiz route → a
     **page object** (`quiz.page.ts`). (A reusable region appearing on ≥2 pages — page-agnostic, no route —
     would be a **component object** under `components/`; canon: `.claude/docs/code-style-guide.md`.) Create
     the class and wire it, leaving the methods area as a placeholder:
     - **Class** → `export class QuizPage extends BasePage { … }` — a page also extends any component
       mixins it renders (e.g. `export class QuizPage extends <Name>Mixin(BasePage)`). SELECTORS banner +
       locator fields, then a single placeholder — **write no methods:**
       ```ts
       // ── METHODS — added by /sdk-builder (do not add @step methods here) ──
       ```
     - **Mixin** (`lib/pages/mixins.ts`): add a `QuizMixin` mirroring the existing ones (it injects the
       object as a property: `this.quizPage = new QuizPage(this.page)`).
     - **Wire the mixin — BY TYPE:** a **page** mixin → into the `WebClient` composition chain in
       `lib/pages/allright-app.ts` (→ `webClient.quizPage`); a **component** mixin → into the page(s) that
       render it (each page `extends <Name>Mixin(...)` → `webClient.quizPage.<component>`), **never** into
       `WebClient`.
     - **Route** (`AppRoute` in `lib/pages/allright-app.ts`): add the quiz entry route
       (`/uk/app/sign-up/long/charlie/age-range`); a component has no route → skip.
7. **`npx tsc --noEmit`** — must pass clean (locator fields + any wiring type-check). Stay read-only on the app.
8. **Report + hand off.** Then hand to **`/sdk-builder`** for the `@step` methods (the generic step engine +
   the outcome oracle).

---

## Report format

Organized **by anatomy part** so completeness is auditable:
- **Object / route** (`quiz.page.ts`, quiz entry route) + mode (**new** vs **extended**), file path.
- **Locators by anatomy part**, each with its intent-name and the **tier used** (Tier 1
  `getByRole`/`getByTestId` vs Tier 2 `data-*`/`[class*="Prefix"]` vs Tier 3 XPath) — i.e. **ARIA/test-id
  clean vs fallback**, per element — and, for the middle, a note confirming it is **content-agnostic** (no
  copy anchor).
- **Options factory** + the real sample step it was verified against.
- **Completeness ledger:** every anatomy part either captured or marked **"not present"**; plus **gaps** —
  states only reachable by mutating the quiz (validation-invalid needing an invalid advance; the success
  surface, which needs a real completion) flagged, **NOT triggered**.
- **Verification:** all locators resolve to exactly one element; `tsc` clean; step kinds sampled.
- **Handoff:** report what was captured, then **offer the next step** via `AskUserQuestion`
  (CLAUDE.md Interaction model), don't auto-proceed: *[▶ proceed to `/sdk-builder`] [✏ capture more
  locators] [⏸ stop]*.

---

## Guardrails (from CLAUDE.md — do not violate)

- **READ-ONLY on the app:** navigate / snapshot / read / hover / step backward-forward only. **NEVER
  complete the quiz** — a finished run creates a real user + trial booking on live stage. Observe the step
  anatomy without submitting the final booking.
- **No login exists** — the quiz is public; do not look for a session or type any password. **Never enter
  real payment / card / credential data. Never solve or bypass a CAPTCHA / bot-detection** — if the flow
  hits one, stop and flag it.
- **LOCATORS ONLY.** No `@step` methods (that's `/sdk-builder`), no test code (that's `/test-write`). A new
  object is created WITH locators and a methods placeholder — nothing more. If you feel the urge to add
  behavior, stop — wrong layer.
- **CONTENT-AGNOSTIC middle.** Locators for the variable steps key on role/shape/structure scoped to the
  step container — **never** on option text, copy, or localized labels. Only contract-level handles (entry,
  advance control, success surface) use a stable test-id/role.
- **Verified-or-it-doesn't-exist:** an unverified locator does not get written. 0 or >1 → re-derive/scope,
  never blind `.first()`.
- **Highest stable tier wins** — Tier 1 user-first by default; CSS only when no clean accessible/`data-*`
  handle; XPath almost never. No banned patterns.
- **EXISTING object = add-only.** Never rewrite or remove its methods or unrelated locators.
- **Branch `aqa/<short-desc>` + PR to `main`**; a human reviews and merges — never push to `main`, never
  auto-merge. **tsc green** before hand-off.
