---
main_goal: A learner turns a topic list and a weekly time budget into a dated plan they keep using.
north_star: S-02 — generating a week of sessions that respects declared availability.
top_blocker: None. F-04 and F-05 landed on 2026-09-11; the app runs against a hosted database at a public address.
---

# Roadmap — 10x Study Planner

- **Input**: `context/foundation/prd.md`
- **Date**: 2026-09-10

Vertical slices first. Each slice ends with something a learner can do; each
foundation names the slice it unblocks, so no groundwork is orphaned.

## North star

**S-02.** Everything else is support. Topics without a plan are a list, and
progress without a plan is a checkbox. The moment the product earns its keep is
when a learner opens it on a Tuesday evening and is told what to study and for
how long.

If only one thing works, it is this.

## Slices

### S-01 — Declare what to learn and when
- **Outcome**: A learner adds topics with an estimate, a priority and an
  optional deadline, and declares minutes available on each weekday.
- **PRD refs**: FR-002, FR-003, US-003, US-004, US-005, US-006, US-007
- **Prerequisites**: F-01, F-02
- **Risk**: Low. Ordinary create-read-update-delete over two tables.
- **Status**: done

### S-02 — Generate a week of study sessions ⭐
- **Outcome**: A learner presses one button and receives dated sessions that
  never exceed the minutes declared for a day, ordered by deadline pressure.
- **PRD refs**: FR-004, US-008, US-009, US-010, US-011
- **Change ID**: S-02-weekly-plan
- **Prerequisites**: S-01
- **Risk**: **High, and the only real risk in the project.** The rule produces
  plausible-looking output when it is wrong, so a defect is invisible rather
  than loud. Mitigated by keeping the rule a pure function and testing it
  exhaustively.
- **Status**: done

### S-03 — Record what actually happened
- **Outcome**: A learner marks a session done or skipped; topic progress and the
  next generated plan both reflect it.
- **PRD refs**: FR-005, US-012, US-013, US-014
- **Prerequisites**: S-02
- **Risk**: Medium. Session status and topic progress can drift apart if written
  separately; handled in one database function.
- **Status**: done

### S-04 — See where the effort went
- **Outcome**: A learner sees the week by day and per-topic completed versus
  estimated minutes.
- **PRD refs**: FR-006, US-015
- **Prerequisites**: S-03
- **Risk**: Low. Read-only presentation.
- **Status**: done

### S-05 — Use it against a real exam
- **Outcome**: The learner reaches the application at a public address and uses
  it for an actual certification, rather than through a local server.
- **PRD refs**: the whole product
- **Prerequisites**: F-04, F-05
- **Risk**: Medium. Depends on external accounts and on a build target that
  cannot be produced on the development machine.
- **Status**: done

### S-06 — Set an evening in place, and see the month
- **Outcome**: A learner fixes one evening's minutes from the day card on the
  plan, without going to Tematy, and reads the whole month at a glance in a
  calendar view.
- **PRD refs**: FR-003, FR-006, US-007
- **Change ID**: S-06-day-editing-and-calendar
- **Prerequisites**: S-02, S-04
- **Risk**: Low. The calendar is a read-only projection of data the week view
  already loads, and the day editor reuses the availability row rather than
  introducing a second source of truth.
- **Status**: done
- Added after the MVP shipped, on 2026-09-13, from use: the plan view showed
  empty evenings but offered no way to fill them, and nothing gave a view wider
  than seven days.

## Foundations

### F-01 — Project skeleton with authentication
- **Unlocks**: S-01
- Astro, React, TypeScript and Tailwind from the course starter, which also
  supplies sign-up, sign-in, sign-out and middleware route protection.
- **Status**: done

### F-02 — Schema with learner isolation
- **Unlocks**: S-01
- Four tables, row level security on each, and `set_session_status` so progress
  bookkeeping cannot half-apply.
- **Status**: done

### F-03 — Quality gates
- **Unlocks**: S-02
- Unit tests for the rule, an end-to-end suite for the flow, and a pipeline that
  runs lint, types, both builds and the tests on every push.
- Listed as a foundation for S-02 specifically: the rule's failure mode is
  silence, so the tests are not overhead on it, they are how it is known to work
  at all.
- **Status**: done

### F-04 — Hosted database
- **Unlocks**: S-05
- A Supabase project with the migration applied, and its credentials available
  locally and to CI.
- **Status**: done
- Was the top blocker until 2026-09-11. The Supabase project exists, the
  migration is applied, and the credentials are available locally and to CI.

### F-05 — Production deployment
- **Unlocks**: S-05
- A Cloudflare account, a scoped API token, and one run of the deploy workflow.
- **Status**: done — live at https://10x-study-planner.ariowistus.workers.dev

## Order

```
F-01 ─┬─> S-01 ──> S-02* ──> S-03 ──> S-04
F-02 ─┘             ▲
F-03 ───────────────┘

F-04 ──> F-05 ──> S-05
```

Both rows are finished. The bottom row was entirely external setup — two free
accounts, four secrets, one manual workflow run — and it landed on 2026-09-11.

Statuses for F-04, F-05 and S-05 plus the `top_blocker` field were corrected on
2026-09-12: the work had shipped but the roadmap still described the project as
blocked on a database that already existed.

## What is deliberately not on this roadmap

The non-goals in the PRD are not "later", they are "no". Putting them here as
future slices would invite scope creep by making them look scheduled.
