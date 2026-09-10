# Implementation Plan — S-02, weekly plan generation

- **Change id**: `S-02-weekly-plan`
- **Roadmap**: `context/foundation/roadmap.md` (north star slice)
- **PRD refs**: FR-004, US-008, US-009, US-010, US-011
- **Date**: 2026-09-10

## The problem in one line

A learner with topics and a weekly time budget presses one button and gets dated
sessions that fit the evenings they actually have.

## What makes this slice risky

Every other slice fails loudly. This one fails quietly: a wrong allocation still
looks like a plan, and a learner would follow it for weeks before noticing that
the topic due on Friday never got scheduled.

That single fact drives the whole design below. The rule is separated from
everything that would make it hard to test, so that it can be tested to the
point where silence is not a risk.

## Design decisions taken before writing code

**The rule is a pure function.** `generatePlan(topics, availability, weekStart)`
returns sessions. It reads no database, no clock, no request. The consequence
worth stating: "today" cannot be consulted inside the rule, so anything
date-relative has to be applied to its inputs beforehand.

**Urgency is a required daily pace, weighted by priority.** Pace is
`remaining / (daysUntilDeadline + 1)`; priority multiplies it by a factor from
0.8 to 1.6. Two properties follow, and both are wanted:

- a deadline that is close outranks a topic that is merely important;
- urgency falls as remaining work shrinks, so topics under similar pressure
  interleave rather than one of them consuming the entire week.

The alternative considered was an additive score, `pace + priority × weight`.
Rejected: a large low-priority backlog then outranks a small topic due in three
days, because the constant term cannot be outgrown.

**Allocation runs one small unit at a time and merges afterwards.** Handing a
topic a whole day in one step would let the first-ranked topic swallow every
evening. Allocating in minimum-block units and re-ranking after each one lets
the falling urgency curve do the interleaving. Units are merged into one session
per topic per day before returning, because the units are an implementation
detail the learner should never see.

**Capacity is an invariant, not a preference.** A day never receives more than
its declared minutes. Everything else in the rule can be argued about; this
cannot.

## Phases

### Phase 1 — Domain types and date arithmetic
Calendar dates as `YYYY-MM-DD` strings, Monday as weekday 0, all arithmetic in
UTC. A timezone shift that moves a session to the wrong evening would be a real
bug and an annoying one to find.

*Verify*: unit tests for parsing, rejection of malformed input, month and year
boundaries, and a daylight-saving transition.

### Phase 2 — The scheduling rule
`urgencyScore`, `remainingMinutes`, `isSchedulable`, `generatePlan`.

*Verify*: unit tests for each guarantee — capacity respected, remaining work
respected, large topics split, zero-availability days untouched, minimum block
honoured except when finishing a topic, finished topics excluded, deterministic
output, ties broken on id.

*Gate*: no work continues until these pass. Everything after this point assumes
the rule is correct.

### Phase 3 — Schema
Four tables, row level security on each, `set_session_status` to move a session
between statuses and adjust topic progress in one call.

*Verify*: `astro check` against the hand-written schema types; the policies are
exercised later by the isolation end-to-end test.

### Phase 4 — Persistence and the planning service
A repository module holding every database call, and a service that loads state,
calls the rule, and writes sessions back. Regeneration keeps sessions the
learner already acted on and removes the capacity they occupy.

*Verify*: type checking and lint; behaviour covered end-to-end in phase 6.

### Phase 5 — Endpoints and interface
Form-driven endpoints that authenticate, validate with Zod, delegate, redirect.
A dashboard showing the week by day, with done, skip and undo per session.

*Verify*: build, plus a manual pass over the flow.

### Phase 6 — End-to-end coverage
The flow a learner walks, and the property that a second learner sees nothing of
the first.

*Verify*: Playwright against a production build.

## Files expected to change

```
src/domain/types.ts          new
src/domain/date.ts           new
src/domain/scheduler.ts      new
src/lib/database.types.ts    new
src/lib/repository.ts        new
src/lib/planning.ts          new
src/lib/validation.ts        new
src/lib/api.ts               new
src/pages/api/**             new
src/pages/dashboard.astro    rewritten
src/pages/topics.astro       new
supabase/migrations/**       new
```

Out of scope: authentication, which the starter already provides, and anything
listed under non-goals in the PRD.

## Manual verification gate

Before this slice is called done, walked by hand: create an account, declare
availability, add two topics with different deadlines, generate, confirm the
nearer deadline is served first, mark a session done, confirm progress moves and
that regenerating does not resurrect the completed session.

## Progress

| Phase | Status | Commit |
| --- | --- | --- |
| 1 — types and dates | done | `5ca79a6` |
| 2 — scheduling rule | done | `5ca79a6` |
| 3 — schema | done | `15adcb9` |
| 4 — persistence and service | done | `15adcb9` |
| 5 — endpoints and interface | done | `15adcb9` |
| 6 — end-to-end coverage | done | `a85d4b0` |
| Manual verification gate | **not done** | blocked on a hosted database |

The manual gate is the one thing outstanding, and it is blocked on F-04 rather
than on any code in this slice.
