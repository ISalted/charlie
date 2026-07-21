---
name: sdk-builder
description: Build or extend the Charlie AQA SDK / framework layer — the METHOD layer. Add intent-named @step act-and-return methods onto the private locators /analyze-page already wrote on the QuizFlow page or a component object — the GENERIC STEP ENGINE (detectStep/answerCurrentStep/advance/isComplete/runToCompletion) and the OUTCOME ORACLE — plus reusable helpers, fixtures, api-client methods, and data factories. Content-agnostic, assertions-in-test, typed unions, real waits, bounded loops. WRITES NO LOCATORS (route to /analyze-page if a locator or object is missing) and NO tests (that's /test-write). Use when asked to add methods/flows to a page or component object, or to add a reusable helper / fixture / api method / data factory. The METHOD step between /analyze-page and /test-write.
model: claude-sonnet-4-6
effort: medium
---

# /sdk-builder — the METHOD layer

You design the **`@step` act-and-return METHODS** onto the private locators that already
exist. You are the **SDK API designer**: turn verified, content-agnostic locators into a
small, composable, intent-named API the test asserts on. The object **MODELS** the quiz; it
**never judges** it. For Charlie the two things you build are:
1. **The GENERIC STEP ENGINE** — `detectStep` / `answerCurrentStep` / `advance` /
   `isComplete` / `runToCompletion` — drives the *variable middle* of the quiz generically,
   never step-by-named-step.
2. **The OUTCOME ORACLE** — the variant-independent business check (account created + trial
   booked) exposed act-and-return for the test to assert.

The locator block, the class scaffold, the mixin, the `WebClient` composition, and the
`AppRoute` entry are **not yours** — `/analyze-page` owns all of that; you consume its output.
Tests are not yours — `/test-write` consumes what you build.

Honour `CLAUDE.md` and **apply** (do not re-teach) the canon:
`.claude/docs/code-style-guide.md` (POM layers, the light `QuizFlow` engine, SOLID, fixtures),
`.claude/docs/playwright-guide.md` (encapsulation, content-agnostic locators, real waits),
`.claude/docs/git-ci-guide.md` (branch / PR / no-auto-merge).

## Boundary — does NOT do (the layer rule, do not cross)
- **No locators.** A missing or wrong locator → **STOP, route to `/analyze-page`**; never
  patch a selector here. *Tell:* if you reach for a `getByRole`/`getByTestId` selector inside
  a method, the locator layer is incomplete → route out, don't inline it.
- **No tests, no assertions.** *Tell:* if you reach for an `expect`, you're in the test
  layer → **STOP, route to `/test-write`**. The object returns; the test judges.
- **No scaffolding.** You create no class, no mixin, no `WebClient` wiring, no route — if
  the right object doesn't exist, **route to `/analyze-page`** to create/extend it.
- These are the **three up-routes**: missing locator, missing test/assertion intent,
  missing object → each goes back to its owning layer, never gets faked here.

## Input contract
A page or component object whose private locators + factories already exist, with the
methods-placeholder banner `/analyze-page` left **below** the locator block. Locators
**above** the banner are your raw material; your methods go **strictly below** it.
**EXISTING object → ADD-ONLY:** reuse existing methods, never rewrite them, never touch the
locator block above the banner.

## Process
1. **Confirm the object + its locators + the banner exist.** Open the target (`QuizFlow`
   page or a component). Every element a method will touch must already have a private
   locator/factory above the banner — including the *shape-based* factories the engine relies
   on (the active-step container, the options factory, the primary advance control). Missing
   object, or a method needs an element with no locator → **STOP, route to `/analyze-page`.**
2. **List the EXACT methods the cases need** — from the `/test-design` checklist at
   `test-design/<area>/CHECKLIST.md` (or the stated requirement): every act and every
   read-back the specs will call. For Charlie that is usually the **engine** + the
   **oracle**. **Build only those — no speculative API.**
3. **For each method, decide its OBJECT** (page vs component — §Placement) **and design it**
   (§SOLID + §Craft): act-and-return, intent-named, content-agnostic, typed, `@step`.
4. **Add under the banner — add-only.** Compose from existing primitives; never duplicate a
   flow; never edit the locator block.
5. **[On request] Path B SDK** — helpers / fixtures / api / data, each in its correct layer
   (§Path B). The **outcome oracle** lives here (api-client). No locators involved.
6. **Verify** `npx tsc --noEmit` clean → **report** (each method: object + signature +
   one-line intent) → **hand off to `/test-write`**.

## Method PLACEMENT — page object vs component object (the first design decision)
Put each method on the object that **OWNS the behaviour**:
- **Behaviour bound to ONE route/screen** → method on the **PAGE object**. The generic step
  engine lives on the **`QuizFlow` page object** — it owns the quiz flow.
- **Behaviour on a reusable widget appearing on ≥2 pages** (a progress indicator, a shared
  "continue" bar, a consent banner) → method on the **COMPONENT object**
  (`components/*.component.ts`), kept **PAGE-AGNOSTIC**: no route assumptions, no `goTo`, no
  host-page knowledge; identifiers/values come **in** as parameters.
- **Composition (how it's reached):** a component **mixes into the PAGES that render it, NOT
  into `WebClient`** — its methods are called via `webClient.<page>.<component>.…` (e.g.
  `webClient.quizPage.progress.getPercent()`). Your method lives on the component class;
  `/analyze-page` already wired the mixin into the page(s).
- Mis-placement is a design bug: shared-widget logic on a page object **kills reuse**;
  route-specific flow on a component **leaks page knowledge** into a shared object.
- If the right object — or a locator it needs — doesn't exist yet → route to
  `/analyze-page`. **This skill never scaffolds objects or writes locators.**

## SOLID, applied to THIS method/object layer (canon: code-style-guide)
- **SRP** — each primitive does ONE thing (`detectStep`, `answerCurrentStep`, `advance`,
  `isComplete`); a high-level flow **composes** primitives. No god-method that detects, answers,
  advances and reads outcome in one body — `runToCompletion` *orchestrates* them.
- **Open/Closed** — extend by **ADDING a method or a new object**, never by bloating a
  method with a `boolean`/mode flag. A new step *kind* is handled inside `answerCurrentStep`'s
  dispatch on the typed `StepKind` union — not by a `runToCompletion(fast = true)` branch.
  New behaviour = new verb, not a new flag.
- **Liskov / Interface-segregation** — a **consistent getter contract** the test relies on:
  `is…()`/`has…()` return `boolean` (`isComplete()`), `get…()` return the value, actions
  return `void` or a single observable (`runToCompletion` → `QuizRunResult`). Small, focused
  methods; no fat method the test must over-read.
- **DRY** — compose existing primitives; call data factories (`quizLead`) from the **test**,
  never from a method; never duplicate the answer-then-advance loop across objects.

## Method-design CRAFT (the heart)
- **ACT-AND-RETURN, NEVER ASSERT.** Actions are verbs that perform the interaction; getters
  read state and **RETURN** it for the test to assert. No `expect` in the SDK — the object
  models the quiz, it never judges it. `runToCompletion` returns an observable
  `QuizRunResult` (`{ reachedEnd, stepsTaken, path }`) — the test decides pass/fail.
- **INTENT names, not mechanics** — `advance()`, not `clickContinueButton()`;
  `detectStep()`, not `readActiveStepRole()`.
- **CONTENT-AGNOSTIC — the A/B rule (non-negotiable here).** A method must **never hardcode
  option text**: `detectStep` classifies by **role/shape** (radios present → single-choice,
  checkboxes → multi-choice, textbox → text, date input → date, no controls → info),
  **NEVER by copy**. `answerCurrentStep` selects a **valid** option by shape/index/persona
  (e.g. first enabled option, or the option matching the persona for constrained inputs like
  age/name/email), so the same code works on *every* A/B variant. `getByText("18-25")` in a
  method is a variant coupling and is banned.
- **DATA-AGNOSTIC** — parameters in; **no data-factory calls and no literals inside a
  method**. The persona (`QuizLead`) is passed by the test; one flow serves every dataset.
- **TYPED UNIONS for closed parameter sets / return values** — the engine keys off
  `type StepKind = "single-choice" | "multi-choice" | "text" | "date" | "info" | "unknown";`
  so `detectStep` is type-safe and the dispatch in `answerCurrentStep` is exhaustive; never a
  bare `string` for a fixed set.
- **`@step()` on EVERY public method** (from the step helper) so each action surfaces as a
  named step in the **Playwright HTML report** (canon: reporting-guide) — critical for reading
  a synthetic-monitoring run's trace.
- **COMPOSITION + a BOUNDED loop** — small single-purpose verbs; `runToCompletion` chains them
  and returns one observable. The loop **MUST be bounded** by a max-step cap so a broken or
  looping A/B variant **fails loudly, doesn't hang**:
  ```
  runToCompletion(persona)  =  loop (up to MAX_STEPS):
                                 kind = detectStep()
                                 if isComplete() → break (reachedEnd = true)
                                 answerCurrentStep(persona)   // valid answer by shape, not copy
                                 advance()                    // wait for the step to CHANGE
                               → return { reachedEnd, stepsTaken, path }  // observable for the test
  ```
  If the cap is hit without `isComplete()`, return with `reachedEnd = false` (and the path) —
  the test asserts and the run fails honestly; never loop forever.

## REAL WAITS, not sleeps
- **`advance()` waits for the step to ACTUALLY change** — await the active-step container to
  detach/replace or the progress signal to move — **never** `waitForTimeout` as a sleep to
  "let the next screen render". A blind sleep both flakes and hides a dead-end.
- **The outcome** — where a create/booking request fires, `waitForResponse` on the **real**
  request and read its status/payload, rather than sleeping and hoping.
- `webClient.waitForTimeout(n)` is in **seconds**; reserve it for genuinely un-observable
  waits, not as the default. Prefer `waitFor`/response waits every time.

### Shape (act-and-return; the object never asserts)
```ts
type StepKind = "single-choice" | "multi-choice" | "text" | "date" | "info" | "unknown";

// read-only: classify the current step by CONTROL SHAPE, never by copy → RETURN the union
@step()
async detectStep(): Promise<StepKind> {
  await this.stepContainer.waitFor({ state: "visible" });
  if (await this.options.first().isVisible()) {
    return (await this.options.count()) > 0 && (await this.isMultiSelect())
      ? "multi-choice" : "single-choice";
  }
  if (await this.textInput.isVisible()) return "text";
  if (await this.dateInput.isVisible()) return "date";
  return "info";
}

// act: pick a VALID answer for whatever step is on screen (by shape/persona, NOT label)
@step()
async answerCurrentStep(persona: QuizLead): Promise<void> {
  switch (await this.detectStep()) {
    case "single-choice": await this.options.first().click(); break;   // any valid option
    case "multi-choice":  await this.options.first().click(); break;
    case "text":          await this.textInput.fill(persona.name); break;
    case "date":          await this.dateInput.fill(persona.dob); break;
    case "info":          break;                                        // nothing to answer
  }
}

// act: click the single primary advance control, then WAIT for the step to change (no sleep)
@step()
async advance(): Promise<void> {
  const before = await this.stepContainer.getAttribute("data-step");
  await this.advanceBtn.click();
  // real wait: the active step must actually replace — never a blind timeout
  await this.stepAfter(before).waitFor({ state: "visible" });
}
```

## Path B — other reusable SDK (no locators), on request only
Author in the correct layer (canon: code-style-guide); same act-and-return,
content-agnostic, typed discipline applies:
- **api-client methods → the OUTCOME ORACLE (the crown jewel).** In the API layer behind the
  `apiClient` fixture: act-and-return methods like `userExists(email): Promise<boolean>` and
  `trialBookedFor(email): Promise<boolean>` that query stage for the created user + booking and
  **return** the JSON/status for the **test** to assert. **There is NO auth / saved-session
  token / admin password** — the quiz is public; oracle creds (if any) come from config, never
  typed into the UI. This is the variant-independent assertion — prefer it over re-running the
  flow to "check".
- **helpers → the network-response oracle fallback.** Behind the `helpers` fixture (or as a
  fixture): a **generic, page-agnostic** utility that asserts the create/booking request
  returned 2xx via a `waitForResponse` intercept — the fallback when the API oracle isn't
  reachable. No page flows, no selectors, no test data.
- **fixtures → the fixtures module** — wire a new capability in the project's fixture style
  (`webClient` / `apiClient` / `helpers`); don't duplicate an existing one.
- **data factories → the data layer** (`lib/data/quiz/`, beside existing factories) —
  controlled, faker-based, producing the typed `QuizLead` the engine consumes: `quizLead(prefix)`
  → a unique, tagged synthetic lead (`aqa.<prefix>.<stamp>@<test-domain>`). Factories live here;
  methods stay data-agnostic (the test calls `quizLead`, the method takes the object).

## Guardrails (canon: code-style-guide, playwright-guide, git-ci-guide)
- **No locators** (→ `/analyze-page`), **no tests/assertions** (→ `/test-write`), **no
  scaffolding** (→ `/analyze-page`). Existing object = **add-only**; never edit the locator
  block above the banner.
- The object **models** the quiz and **never asserts**. **The loop is BOUNDED** — never write
  a `while (!isComplete())` with no cap. **Never hardcode option copy** in a method (A/B death).
- **Completion is a REAL mutation on live stage** (creates a user + trial). The engine you build
  is *the* thing that mutates — that's intended, but prefer the **API oracle** for read-back over
  re-running the flow, keep runs minimal, and use **synthetic tagged leads** only (`quizLead`).
  **Never automate around a CAPTCHA / bot-detection; never enter real payment or credentials** —
  if the flow demands them, stop and flag it.
- **`tsc` clean** before hand-off. **Branch `aqa/<short-desc>` + PR to `main`** — prefer
  **folding the SDK into the eventual `/test-write` PR** so methods land with their first
  consumer. **Never push to `main`, never auto-merge** — a human reviews and merges.

## Hand off
Report each method added (object it lives on + signature + one-line intent) and any Path B
SDK (esp. the oracle), confirm `tsc` green, then **offer the next step** via `AskUserQuestion`
(CLAUDE.md Interaction model), don't auto-proceed: *[▶ proceed to `/test-write`] [✏ add/adjust a
method] [⏸ stop]*.
