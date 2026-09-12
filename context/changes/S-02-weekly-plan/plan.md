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

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Domain types and date arithmetic

#### Automated

- [x] 1.1 Unit tests for parsing, rejection of malformed input, month and year boundaries, and a daylight-saving transition — `5ca79a6`

### Phase 2: The scheduling rule

#### Automated

- [x] 2.1 Unit tests for every guarantee — capacity respected, remaining work respected, large topics split, zero-availability days untouched, minimum block honoured except when finishing a topic, finished topics excluded, deterministic output, ties broken on id — `5ca79a6`

#### Manual

- [x] 2.2 Gate: confirm the rule's tests pass before any later phase proceeds — `5ca79a6`

### Phase 3: Schema

#### Automated

- [x] 3.1 `astro check` against the hand-written schema types — `15adcb9`

### Phase 4: Persistence and the planning service

#### Automated

- [x] 4.1 Type checking and lint — `15adcb9`

### Phase 5: Endpoints and interface

#### Automated

- [x] 5.1 Production build succeeds — `15adcb9`

#### Manual

- [x] 5.2 Manual pass over the form-driven flow — `15adcb9`

### Phase 6: End-to-end coverage

#### Automated

- [x] 6.1 Playwright against a production build — `a85d4b0`

### Phase 7: Manual verification gate

#### Manual

- [x] 7.1 Create an account, declare availability, add two topics with different deadlines, generate, confirm the nearer deadline is served first, mark a session done, confirm progress moves — covered by `e2e/planner.spec.ts` against the deployed app
- [x] 7.2 Confirm that regenerating does not resurrect the completed session — covered by `e2e/planner.spec.ts`

Step 7.2 was the last item open. The behaviour was implemented all along —
`regenerateWeek` in `src/lib/planning.ts` deletes only `planned` sessions and
subtracts settled minutes from the evening's capacity — but nothing verified it:
the domain unit tests cannot reach it (it is I/O), and the end-to-end suite
stopped one step earlier, after marking a session done. Closed on 2026-09-12 by
an assertion in `e2e/planner.spec.ts` that regenerates the week after completing
a session and confirms the completed evening survives and does not reappear as
planned work. No product code changed.

Phases 1-6 were originally recorded as a summary table. Rewritten on 2026-09-12
into the canonical checkbox format the executor skills parse, with every commit
SHA carried over unchanged.
