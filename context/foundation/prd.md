# Product Requirements Document — 10x Study Planner

- **Source**: `context/foundation/shape-notes.md`
- **Date**: 2026-09-10
- **Mode**: greenfield
- **Status**: contract for implementation

This document describes the product and the business rules. It deliberately
says nothing about frameworks, hosting or tooling — those belong to
`tech-stack.md` and `infrastructure.md`.

---

## 1. Vision

A learner preparing for a dated exam knows *what* they have to cover but not
*when*. 10x Study Planner turns a topic list, a deadline and a realistic weekly
budget of evening minutes into a concrete dated plan, and keeps that plan honest
as real life interferes with it.

The product owns one decision and owns it well: what to study today, and for how
long.

## 2. Problem

Allocating limited study time across competing topics is a small optimisation
problem that people solve badly when tired. Left to intuition, learners
gravitate to comfortable topics and postpone large or unpleasant ones, and the
resulting gap only becomes visible when there is no longer time to close it.

Doing the allocation once is not enough. A plan that is not recomputed after
missed evenings is wrong within a week.

## 3. Persona

**Marek, 32, IT professional.**

- Preparing for a professional certification, exam booked about eight weeks out.
- Studies 30 to 90 minutes on weekday evenings, longer on weekends.
- Loses one or two planned evenings a week to work or family.
- Already has his topic list. He wants sequencing, not content.

**Out of scope as users**: full-time students with open calendars, and tutors or
managers planning on someone else's behalf.

## 4. Success criteria

| # | Criterion | How it is checked |
| --- | --- | --- |
| SC-1 | A new account reaches a generated weekly plan in under three minutes | end-to-end test walks the flow |
| SC-2 | No day is ever scheduled beyond its declared availability | invariant, covered by unit tests |
| SC-3 | Completing a session is reflected in topic progress and in the next generation | unit and end-to-end tests |
| SC-4 | A topic with a nearer deadline is scheduled ahead of a higher-priority topic with a distant one | unit test on the ordering rule |
| SC-5 | A learner can only ever read or write their own data | enforced by row level security |

## 5. User stories

### Access

**US-001 — Protected data**
> **Given** I am not signed in
> **When** I open the dashboard
> **Then** I am redirected to the sign-in page

**US-002 — Sign up and sign in**
> **Given** I have no account
> **When** I register with an email and a password and then sign in
> **Then** I reach my own empty dashboard

### Topics

**US-003 — Add a topic**
> **Given** I am signed in
> **When** I add a topic with a title, an estimate in minutes and a priority
> **Then** the topic appears in my topic list and becomes available for planning

**US-004 — Edit a topic**
> **Given** I mis-estimated a topic
> **When** I change its estimate or priority
> **Then** the change is saved and affects the next generated plan

**US-005 — Delete a topic**
> **Given** I have a topic I no longer need
> **When** I delete it
> **Then** it disappears from my list and from future plans

### Availability

**US-006 — Declare availability**
> **Given** I study only on some evenings
> **When** I set minutes for each weekday
> **Then** those values are stored and used as the capacity for planning

**US-007 — Protect a free day**
> **Given** I never study on Fridays
> **When** I set Friday to zero minutes and generate a plan
> **Then** no session is scheduled on Friday

### Planning

**US-008 — Generate a plan**
> **Given** I have topics and declared availability
> **When** I generate this week's plan
> **Then** I see dated sessions, grouped by day, whose minutes never exceed that
> day's declared availability

**US-009 — Deadline pressure wins**
> **Given** one topic is due this week and another in a month
> **When** I generate a plan
> **Then** the topic due this week receives time first

**US-010 — Large topics are split**
> **Given** a topic estimated at more minutes than any single day allows
> **When** I generate a plan
> **Then** the topic is split across several days rather than dropped or truncated

**US-011 — Regenerate**
> **Given** my week went differently than planned
> **When** I regenerate the plan
> **Then** the remaining days are re-planned from actual remaining work, and
> sessions already completed are preserved

### Progress

**US-012 — Complete a session**
> **Given** a planned session of 45 minutes
> **When** I mark it done
> **Then** the topic's remaining minutes drop by 45 and my weekly progress rises

**US-013 — Skip a session**
> **Given** a planned session I did not do
> **When** I mark it skipped
> **Then** the topic's remaining minutes are unchanged and the work returns to
> the pool for the next generation

**US-014 — Finished topics stop appearing**
> **Given** a topic whose completed minutes reached its estimate
> **When** I regenerate the plan
> **Then** that topic receives no further sessions

**US-015 — See progress**
> **Given** I have completed some sessions this week
> **When** I open the dashboard
> **Then** I see per-topic completed versus estimated minutes and what remains
> scheduled for the rest of the week

## 6. Functional requirements

| ID | Requirement |
| --- | --- |
| FR-001 | Email and password authentication; unauthenticated access to learner data is redirected to sign-in |
| FR-002 | Full create, read, update and delete for topics, each owned by exactly one user |
| FR-003 | Per-weekday availability in minutes, where zero is valid and means "do not schedule" |
| FR-004 | Generation of a dated weekly plan from active topics and declared availability |
| FR-005 | Marking a session done or skipped, with the corresponding effect on topic progress |
| FR-006 | A dashboard showing this week's sessions by day and per-topic progress |
| FR-007 | Database-level isolation of every learner-owned row |

## 7. Business logic

> **The rule.** The planner allocates each week's declared available minutes to
> study topics in descending order of an urgency score derived from priority,
> remaining minutes and days remaining until the deadline, and recomputes the
> allocation whenever a session is completed or skipped.

Behaviour required of the rule:

1. **Urgency ordering.** Topics compete on a single score. Deadline pressure
   dominates priority as the deadline approaches; with no deadline, priority and
   remaining work decide.
2. **Capacity is an invariant.** The minutes scheduled on any day never exceed
   the availability declared for that weekday.
3. **Chunking.** A topic larger than one day's capacity is spread over several
   days.
4. **Minimum useful block.** No session shorter than the configured minimum is
   emitted; leftover capacity below that threshold is left unused.
5. **Exhaustion.** A topic is scheduled only up to its remaining minutes, and a
   topic with nothing remaining is skipped entirely.
6. **Determinism.** The same inputs produce the same plan, so the behaviour is
   testable and explainable to the learner.

## 8. Data model

**topics** — what has to be covered
`id`, `user_id`, `title`, `estimated_minutes`, `completed_minutes`,
`priority` (1–5), `deadline` (nullable date), `status`, `created_at`, `updated_at`

**availability** — how much time exists
`user_id`, `weekday` (0–6), `minutes`

**plans** — one generated week
`id`, `user_id`, `week_start`, `generated_at`

**sessions** — a dated block of work on one topic
`id`, `plan_id`, `user_id`, `topic_id`, `scheduled_date`, `minutes`,
`status` (planned / done / skipped), `completed_at`

Every learner-owned row carries `user_id` so isolation can be enforced by a
direct comparison with the authenticated user.

## 9. Access control

- Authentication is email and password.
- Authorisation is ownership: a learner reads and writes only rows whose
  `user_id` matches their own.
- The rule is enforced in the database through row level security, so an
  application-level mistake cannot expose another learner's data.
- There are no roles, no sharing and no administrative access in this scope.

## 10. Non-goals

- Mobile or desktop clients.
- Spaced repetition or learning-science scheduling beyond the urgency rule.
- Storage of learning content: notes, flashcards, files, links.
- AI generation of topics or material.
- Sharing, teams, tutors, or more than one user per account.
- Calendar, email or push integrations; reminders of any kind.
- Payments, subscription tiers, quotas.
- Import from external tools.

## 11. Open questions

1. The minimum useful session block is set to 15 minutes; 20 or 25 may serve the
   persona better and this has not been validated.
2. Weeks run Monday to Sunday and this is not configurable.
3. A topic whose deadline has already passed is treated as maximally urgent
   rather than being archived; the right default is unclear until the app is
   used against a real exam date.
4. Urgency compares required daily pace, which treats a deadline as a slope
   rather than a cliff. A topic due tomorrow with fifteen minutes left can
   therefore lose its last block to a much larger topic due in a month. It is
   defensible — the small topic genuinely needs less time per day — but a
   learner may reasonably expect tomorrow's deadline to be cleared first.
   Changing it means scoring the risk of missing a deadline, not patching the
   allocation loop.
5. Email confirmation is switched off in the hosted project. It keeps the
   sign-up flow usable for demonstration and keeps the end-to-end suite off the
   provider's mail rate limit, at the cost of allowing registration with an
   address nobody owns. Acceptable while the only data an account holds is its
   own study list; it would not be acceptable if the product ever sent mail or
   held anything of value.
