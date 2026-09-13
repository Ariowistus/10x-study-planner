# Test Plan — 10x Study Planner

## Current coverage contract — calendar-first, 2026-09-13

The UI has two views, Realizacja and Kalendarz. Obsolete wizard, topic-page and
availability-editor UI scenarios are replaced by calendar CRUD and completion
journeys. The pure scheduler suite remains intact; generator preservation and
manual reservation behavior remain tested via its real API. No assertions are
weakened to retain the previous screen layout.

Current risks: hour/date/duration persistence, repeat-name progress denominator,
completion undo, blocked completed edits/deletes, overlapping and concurrent
reservations, invalid dates/times, CSRF, cross-account read/write isolation,
old bookmarks, untimed data and timed ICS, and focus timer without auto-completion.
The authenticated fixture creates a fresh account via real application endpoints
and deletes only its own topics through authenticated APIs after each scenario.
CI discards its entire local Supabase stack. Hosted test auth accounts remain.

The historical matrix below documents the earlier UI. Current executable cases
are in e2e/planner.spec.ts, seed.spec.ts, completed-session.spec.ts and focus-session.spec.ts.

- **Inputs**: `prd.md`, `tech-stack.md`
- **Date**: 2026-09-10

## What this project is actually risking

The application is small, and most of it is plumbing that fails loudly: a
mistyped column name breaks immediately, a missing route returns a 404. Testing
that plumbing exhaustively would buy very little.

Two things are different, and they get the attention:

1. **The scheduling rule.** It is the only place with real logic, it produces
   plausible-looking output when it is wrong, and a learner would trust a bad
   plan for weeks before noticing. A silent wrong answer is the worst failure
   mode this product has.
2. **Learner isolation.** Getting it wrong exposes one person's data to another.
   It is the only failure here that is worse than being useless.

Everything else is covered by one walk through the main flow.

## Layers

| Layer      | Tool                  | Scope                                            | Where                  |
| ---------- | --------------------- | ------------------------------------------------ | ---------------------- |
| Unit       | Vitest                | the scheduling rule and its date arithmetic      | `src/domain/*.test.ts` |
| End-to-end | Playwright            | the user-visible flow against a production build | `e2e/*.spec.ts`        |
| Static     | ESLint, `astro check` | types and lint across the repository             | CI                     |

There is no integration layer between the two. The repository functions are thin
wrappers over Supabase queries; testing them against mocks would assert that the
mocks behave like the mocks. The end-to-end tests exercise them against a real
database instead.

## Unit tests — the scheduling rule

The rule is a pure function, so it can be tested exhaustively at no cost. What
is covered, and why each case earns its place:

| Behaviour                                                      | Why it matters                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A day is never scheduled beyond its declared availability      | SC-2, the one hard invariant; violating it makes every plan a lie         |
| A topic never receives more than its remaining minutes         | prevents scheduling work that does not exist                              |
| A topic larger than one day is split across days               | US-010; the alternative failure is silent truncation                      |
| A zero-availability day stays empty                            | US-007; a protected evening is a promise                                  |
| A nearer deadline outranks a distant one                       | US-009, the core of the rule                                              |
| A deadline topic outranks an important topic with no deadline  | the ordering that a purely priority-based score would get wrong           |
| An overdue deadline is maximally urgent                        | recorded as an open question; the test pins current behaviour             |
| Finished and archived topics are not scheduled                 | US-014                                                                    |
| No session below the minimum block, unless it finishes a topic | keeps plans free of unusable fragments                                    |
| Capacity below the minimum block is left unused                | the deliberate consequence of the rule above                              |
| One merged session per topic per day                           | the allocation loop works in small units; the learner should not see them |
| Identical input produces an identical plan                     | without determinism, nothing above is a stable test                       |
| Ties break on topic id, not input order                        | otherwise plans would shuffle between runs                                |
| Completed work reduces the next plan                           | SC-3, the recomputation half of the business rule                         |
| A week that does not start on Monday is rejected               | fails loudly rather than producing a shifted plan                         |

Date arithmetic is tested separately: parsing, rejecting malformed input, month
and year boundaries, day counts across a daylight-saving transition, and the
Monday-first weekday index.

**Coverage.** Thresholds are enforced in `vitest.config.ts` at 90% of statements,
lines and functions and 85% of branches, scoped to `src/domain/`. The number is
not the goal; the scope is. Applying a threshold to the whole repository would
reward tests of markup.

## End-to-end tests

One browser, one worker, run against `npm run build && npm run start`, so the
tested artefact is the one that ships.

| Scenario                                                                                                                 | Requirement                                  |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| An unauthenticated visitor is redirected from the dashboard and from topics                                              | US-001                                       |
| A learner registers, declares availability, adds a topic, generates a plan, marks a session done, and sees progress move | SC-1, US-003, US-006, US-008, US-012, US-015 |
| A day left at zero minutes receives nothing                                                                              | US-007                                       |
| The topic due soonest is scheduled ahead of one due in two months                                                        | US-009                                       |
| Regenerating a week leaves a completed session untouched and does not replan its evening                                 | SC-3, the S-02 manual gate                   |
| Evenings that have already passed receive no work                                                                        | FR-004                                       |
| A deleted topic disappears                                                                                               | US-005                                       |
| A topic with a zero estimate is rejected, both in the browser and when the browser is bypassed                           | FR-002 validation                            |
| A second learner sees an empty account                                                                                   | SC-5                                         |

The isolation test is deliberately end-to-end rather than a unit test of a
policy string. It asserts the property that matters — a second learner sees
nothing of the first — through the same path a real user takes.

## Quality gates

Submission extensions (2026-09-13) protect these additional risks:

- `e2e/seed.spec.ts`: editing a topic persists across reload; filtering never
  deletes data. Also provides the exemplar for new E2E scenarios.
- `e2e/focus-session.spec.ts`: timer start, pause and reset do not write progress;
  export agrees with the saved week; explicit completion survives reload.
- `e2e/completed-session.spec.ts`: direct deletion of a completed session is
  refused; undo and subsequent deletion leave zero progress.
- `src/domain/reservations.test.ts`: manual work is not allocated twice.
- `src/domain/calendar-export.test.ts`: date boundaries, status selection,
  calendar-property injection and UTF-8 folding in exported files.
- Date tests reject impossible dates instead of silently moving them into the
  following month. Routes use the same validation before selecting a period.

New E2E tests use independent HTTP-authenticated accounts and storageState, with
topic cleanup after each test. The historical suite uses UI registration and
leaves test accounts and records behind in hosted Supabase. CI runs against a
disposable local Supabase instance. Never use an actual learner account as a
test fixture.

Nothing merges to `main` unless all of it passes:

1. ESLint, with type-checked rules.
2. `astro check`, zero errors.
3. Unit tests, including the coverage thresholds.
4. A Node build and a Cloudflare build.
5. End-to-end tests against a Supabase instance started in the runner.

Gate 4 exists because the production runtime cannot be built on the maintainer's
machine. CI is the only place that failure would be caught, so it runs on every
push rather than at deploy time.

## What is deliberately not tested

- **Supabase authentication itself.** It is a third-party service with its own
  test suite. The tests cover our use of it, not its correctness.
- **Visual appearance.** No snapshot or screenshot assertions. The interface is
  functional and will change; snapshots would break constantly while catching
  nothing that matters.
- **The repository layer in isolation.** See the note above on mocks.
- **Load and performance.** A single-learner planner with tens of topics has no
  meaningful performance risk.
- **Accessibility, beyond what the linter checks.** `eslint-plugin-jsx-a11y`
  runs; there is no dedicated audit. This is a scope decision, not a claim that
  the interface is accessible.

## Known gaps

1. **Unit tests do not run in `workerd`.** A runtime difference between Node and
   the production edge runtime would surface only in end-to-end tests or in
   production.
2. **The end-to-end suite runs against a local Supabase in CI**, not the hosted
   project. Configuration differences — email confirmation, password policy,
   rate limits — are not covered there. The suite has been run against the
   hosted project from a developer machine, which is how the regeneration
   scenario was first verified, but nothing automates that.
3. **Week boundaries are the server's, not the learner's.** `todayIso()` reads
   the server clock, so a learner in a distant timezone could see the week roll
   over at an odd moment. Not covered by a test because the behaviour is not yet
   decided; it is an open question in the PRD.
