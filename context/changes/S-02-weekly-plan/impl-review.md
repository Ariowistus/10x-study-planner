# Implementation Review — S-02, weekly plan generation

- **Change id**: `S-02-weekly-plan`
- **Against**: `plan.md` in this directory
- **Date**: 2026-09-10

## Scorecard

| Dimension | Verdict | Note |
| --- | --- | --- |
| Plan adherence | **match** | six phases, in order, no unplanned files |
| Correctness | **findings** | one real defect found and fixed; see F-1 |
| Security | **match** | isolation in the database, secrets never in the repository |
| Performance | **match** | no risk at this scale |
| Project conventions | **findings** | see F-4 |
| Test coverage | **findings** | one gap accepted; see F-3 |

## Drift against the plan

Nothing structural. Two additions were not in the plan and are noted rather than
hidden:

- `remainingCapacity()` in the domain layer, added in response to F-1.
- `src/lib/database.types.ts`, added when strict lint rules rejected the untyped
  query results. It was implied by "hand-written schema types" but not listed.

No planned file was skipped. No file outside the plan's scope was touched.

## Findings

### F-1 — The planner scheduled evenings that had already passed
**Severity: high. Decision: fix now. Fixed.**

Generating a plan on a Thursday put sessions on Monday, Tuesday and Wednesday of
that week. The rule plans a whole week and had no notion of "now" — correctly,
since consulting the clock inside it would destroy its testability.

The fix keeps that property: `remainingCapacity(availability, weekStart, today)`
zeroes the capacity of days already gone, and the planning service applies it
before calling the rule. The current date is applied to the *input*, not read
inside the decision.

Found by reasoning about what an end-to-end test would see, not by a failing
test — which is itself the point about this slice's failure mode being silent.

### F-2 — A quality gate was masked by a shell pipeline
**Severity: high. Decision: fix now. Fixed, and recorded as a lesson.**

`npm run lint | grep -v noise && git commit` reported success and committed code
carrying twelve formatting errors, because the exit status came from `grep`.

Every gate now captures its own exit code before its output is filtered. Written
to `context/foundation/lessons.md`, because it will happen again otherwise.

### F-3 — The rule is never exercised in the production runtime
**Severity: medium. Decision: accept the risk, with it written down.**

Unit tests run in Node. Production runs on `workerd`. A runtime difference would
surface only in the end-to-end suite or in production.

Accepted because the rule uses nothing beyond arithmetic, `Map`, and `Date.parse`
on ISO strings, and because closing the gap properly means running the suite
inside `workerd` — which is exactly what does not start on this machine. Recorded
in the test plan under known gaps and in `infrastructure.md` under risks.

### F-4 — Defensive null checks that the compiler proved unreachable
**Severity: low. Decision: fix differently. Fixed.**

Guards like `if (!rows[0])` after a `select` were flagged as dead code once the
client was typed, because TypeScript treats array indexing as always defined.

The first instinct — silence the rule — would have kept a guard that reads like
safety while providing none. Instead the queries moved to `.single()` and
`.maybeSingle()`, whose types genuinely admit the empty case, so the remaining
checks are real. Recorded as a lesson.

### F-5 — Twenty-seven dependency advisories, two critical
**Severity: medium. Decision: skip, deliberately, with a date attached.**

All sit in the development dependency tree inherited from the starter; none are
in the runtime path that reaches production.

Skipped because the only available remedy is `npm audit fix --force`, which moves
major versions of build tooling four days before a submission deadline. The risk
of breaking a working pipeline is larger, right now, than the risk from
development-only advisories.

**This is a deferral, not a dismissal.** It should be the first thing addressed
after submission, on a branch, with CI to catch what it breaks. Recorded in
`verification.md`.

### F-6 — End-to-end tests were quietly date-dependent
**Severity: medium. Decision: fix now. Fixed.**

After F-1, planning scenarios would have produced a different number of sessions
depending on which day CI ran, and would have failed outright on a Sunday. They
now plan next week, where all seven days are still ahead.

Worth noting as a category: a test that passes today and fails on Sunday is
worse than no test, because it teaches the team to ignore red.

### F-7 — The week boundary follows the server clock
**Severity: low. Decision: skip; already an open question in the PRD.**

`todayIso()` reads the server's local date, so a learner in a distant timezone
could see the week roll over at an odd hour. Not fixed because the correct
behaviour has not been decided — storing a per-learner timezone is a product
decision, not a bug fix. It is listed in the PRD's open questions and in the test
plan's known gaps.

## Lessons recorded

Four entries were appended to `context/foundation/lessons.md` from this slice:
the runtime that will not start locally, the masked exit code, guards the
compiler disproves, and keeping the domain rule free of I/O.

## Verdict

The slice is complete against its plan, with one exception carried forward: the
manual verification gate has not been walked, because there is no hosted
database yet. Until that happens, the correctness claim rests on the unit tests
and on the parts of the end-to-end suite that run without one.

That is stated plainly rather than rounded up to "done".

---

## Postscript — 2026-09-12

The exception carried forward above has since resolved, and this section records
that rather than rewriting the verdict, which stands as it was written.

F-04 and F-05 landed on 2026-09-11: the application runs against a hosted
Supabase project at a public address, and the user-visible flow was walked
against it. Its last step — confirming that regeneration does not resurrect a
completed session — had been an automation gap rather than a product defect:
`regenerateWeek` implemented the behaviour, but no unit test could reach it and
the end-to-end suite stopped one step short. That assertion now exists, so the
gate is fully closed and every step of the plan's `## Progress` is ticked.

Both observations were recorded as recurring rules in
`context/foundation/lessons.md`.
