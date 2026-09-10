---
main_goal: A learner turns a topic list and a weekly time budget into a dated plan they keep using.
north_star: S-02 — generating a week of sessions that respects declared availability.
top_blocker: No hosted database yet, so nothing can be exercised against real data.
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
- **Status**: blocked — waiting on F-04

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
- **Status**: blocked — needs an account to be created
- This is the **top blocker**. Until it exists, the application has been
  exercised only against its own test doubles and a local server with no data.

### F-05 — Production deployment
- **Unlocks**: S-05
- A Cloudflare account, a scoped API token, and one run of the deploy workflow.
- **Status**: blocked — needs F-04 and an account

## Order

```
F-01 ─┬─> S-01 ──> S-02* ──> S-03 ──> S-04
F-02 ─┘             ▲
F-03 ───────────────┘

F-04 ──> F-05 ──> S-05
```

Everything on the top row is finished. The bottom row is entirely external
setup: two free accounts, four secrets, one manual workflow run.

## What is deliberately not on this roadmap

The non-goals in the PRD are not "later", they are "no". Putting them here as
future slices would invite scope creep by making them look scheduled.
