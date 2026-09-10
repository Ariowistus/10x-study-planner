# Shape Notes — 10x Study Planner

- **Mode**: greenfield
- **Date**: 2026-09-10
- **Status**: decisions recorded, open questions listed at the end

These are the decisions taken before any implementation. They are the input for
`prd.md`. Anything that was not decided is written down as an open question
instead of being guessed.

---

## Phase 1 — Vision & problem

**What is the problem?**

A working adult preparing for a certification exam has a list of topics to
cover, a hard exam date, and a small and irregular amount of evening time. The
scarce resource is not information, it is attention allocation. Every evening
starts with the same unproductive question: "what should I study today?"

The usual failure mode is not laziness. It is that the learner keeps returning
to topics that feel comfortable, while the topics that are large, unpleasant or
close to the deadline keep sliding. By the time the gap becomes visible there is
no time left to close it.

**Why now / why software?**

The allocation is a small optimisation problem that a human solves badly under
fatigue and well on paper — but nobody redoes it on paper every evening after
work. It has to be recomputed automatically after every completed or skipped
session, otherwise it goes stale within days.

**What it is not**

It is not a flashcard app, not a spaced-repetition engine, and not a note
taking tool. It does not hold learning content at all. It only decides *what to
work on, on which day, for how long*.

---

## Phase 2 — Persona & access control

**Primary persona**

Marek, 32, works in IT. Preparing for a professional certification with an exam
booked roughly eight weeks out. Studies on weekday evenings for 30 to 90
minutes, more on weekends, and loses one or two evenings a week to life. He
knows his topic list already — he does not want the app to invent it.

**Explicit non-persona**

Full-time students with open calendars, and teams or tutors managing other
people's learning. Both would push the product towards scheduling and
collaboration features that are out of scope.

**Access control**

- Email and password authentication through Supabase Auth.
- Every row of learner data belongs to exactly one user.
- Isolation is enforced in the database with row level security, not only in
  application code, so a mistake in a query cannot leak another user's data.
- No roles, no sharing, no admin panel in the MVP.

**Checkpoint**: access control decided.

---

## Phase 3 — MVP discipline

**First valuable flow** (this is the whole MVP):

1. Sign up and sign in.
2. Add study topics: title, estimated total minutes, priority, optional deadline.
3. Declare weekly availability: how many minutes are realistically available on
   each weekday.
4. Generate a plan for the current week. The app allocates the available
   minutes to topics and produces dated study sessions.
5. Mark a session as done or skipped. Remaining work and the next generation
   both reflect it.

**Cost estimate**: the flow is reachable well inside three weeks of after-hours
work. The starter already supplies authentication, so the new surface is four
tables, one scheduling function, four screens and one API surface.

**Deliberately deferred** (see non-goals): everything else.

**Checkpoint**: MVP fits the timebox.

---

## Phase 4 — Functional requirements and user stories

### FR-001 — Account access
The learner can create an account, sign in, and sign out. Unauthenticated
requests to learner data are redirected to sign-in.

> **US-001**
> Given I am not signed in
> When I open the dashboard
> Then I am redirected to the sign-in page

### FR-002 — Topic management
The learner can create, read, update and delete study topics. A topic carries a
title, an estimated total number of minutes, a priority from 1 to 5, and an
optional deadline.

> **US-002**
> Given I am signed in and on the topics view
> When I add a topic with a title, an estimate and a priority
> Then the topic appears in my topic list and is available for planning

> **US-003**
> Given I have a topic I no longer need
> When I delete it
> Then it disappears from my list and from any future generated plan

### FR-003 — Weekly availability
The learner can declare, per weekday, how many minutes are available. Zero is a
valid and meaningful value — it means "do not schedule anything that day".

> **US-004**
> Given I never study on Fridays
> When I set Friday availability to zero and generate a plan
> Then no session is scheduled on Friday

### FR-004 — Plan generation
The learner can generate a plan for a week. The planner distributes the
available minutes across topics, ordered by urgency, and produces dated
sessions. Regenerating a week replaces its unstarted sessions and preserves the
record of what was already done.

> **US-005**
> Given I have three topics and declared availability
> When I generate this week's plan
> Then I see dated sessions whose total minutes per day never exceed my declared
> availability for that day

> **US-006**
> Given a topic whose deadline is this week and another due in a month
> When I generate a plan
> Then the topic due this week receives time first

### FR-005 — Session progress
The learner can mark a session as done or skipped. Completing a session adds
its minutes to the topic's completed total; skipping does not. A topic whose
completed minutes reach its estimate stops being scheduled.

> **US-007**
> Given a planned session of 45 minutes
> When I mark it done
> Then the parent topic's remaining minutes drop by 45 and my weekly progress
> increases

> **US-008**
> Given a topic that is fully covered
> When I regenerate the plan
> Then that topic receives no further sessions

### FR-006 — Progress visibility
The dashboard shows, for the current week, the scheduled sessions grouped by
day, and per-topic progress as completed versus estimated minutes.

> **US-009**
> Given I have completed some sessions this week
> When I open the dashboard
> Then I can see how much of each topic is done and what is left for the rest of
> the week

---

## Phase 5 — Business logic and data

### The domain rule, in one sentence

> The planner allocates each week's declared available minutes to study topics
> in descending order of an urgency score derived from priority, remaining
> minutes and days remaining until the deadline, and recomputes the allocation
> whenever a session is completed or skipped.

This is the part that makes the product more than a list. Concretely:

- **Urgency score.** Each active topic gets a score built from its priority, the
  work still remaining on it, and the pressure of its deadline. A topic with no
  deadline is driven by priority and remaining work alone. A topic whose
  deadline is close outranks a higher-priority topic with a distant one.
- **Capacity respect.** A day never receives more minutes than declared. This is
  an invariant, not a preference.
- **Chunking.** A topic larger than a single day's capacity is split across
  several days rather than dropped or truncated.
- **Minimum useful block.** Sessions below a small threshold are not produced,
  because a five-minute fragment is scheduling noise rather than study time.
- **Recomputation.** Completion and skipping both change remaining work, so the
  next generation reflects reality rather than the original estimate.

### Data model

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `topics` | what the learner has to cover | `user_id`, `title`, `estimated_minutes`, `completed_minutes`, `priority`, `deadline`, `status` |
| `availability` | how much time exists per weekday | `user_id`, `weekday`, `minutes` |
| `plans` | one generated week | `user_id`, `week_start`, `generated_at` |
| `sessions` | a dated block of work on one topic | `plan_id`, `user_id`, `topic_id`, `scheduled_date`, `minutes`, `status` |

Ownership is carried on every learner-owned row so row level security can be
expressed as a simple comparison against the authenticated user.

**Checkpoint**: data model decided.

---

## Phase 6 — Product framing

- **Product type**: web application, server-rendered, single user per account.
- **Scale**: single learner per account, tens of topics, hundreds of sessions.
  No multi-tenancy or scale concerns beyond correct isolation.
- **Constraints**: built after hours against a fixed course deadline, so scope
  discipline outranks feature ambition.

---

## Non-goals

Explicitly **not** in this project:

- Mobile or desktop applications.
- Spaced repetition or any learning-science scheduling beyond the urgency rule.
- Content storage: notes, flashcards, files, links.
- AI generation of topics or study material.
- Sharing, teams, tutors, or any second user on an account.
- Calendar, email or push integrations, and reminders of any kind.
- Payments, plans, quotas.
- Import from external sources.

---

## Closing soft-gate

| Question | Answer |
| --- | --- |
| Access control | Supabase Auth, per-user rows, row level security |
| Data model | four tables, listed above |
| Business logic | one sentence, recorded above |
| Project artifacts | this file, `prd.md`, `tech-stack.md`, `infrastructure.md`, test plan |
| MVP in three weeks | yes, comfortably |
| Non-goals | listed explicitly above |

---

## Open questions

1. **Session granularity.** Sessions are currently allocated in whole minutes
   with a minimum useful block. Whether that minimum should be 15, 20 or 25
   minutes is a product judgement that has not been settled and is currently
   set to 15 in the implementation.
2. **Week boundary.** Weeks are treated as Monday to Sunday. This suits a
   European learner but is not configurable.
3. **Overdue deadlines.** A topic whose deadline has already passed is currently
   treated as maximally urgent rather than archived automatically. This may be
   the wrong default once the app is used for a real exam.
