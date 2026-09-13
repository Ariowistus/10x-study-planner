# 10x Study Planner

Turns a topic list, a deadline and a realistic weekly budget of evening minutes
into a dated study plan — and keeps that plan honest when real life interferes
with it.

Built as the course project for 10xDevs 3.0.

**Live application:** [10x Study Planner](https://10x-study-planner.ariowistus.workers.dev)

**Course submission:** [criteria audit and demo walkthrough](docs/submission-audit.md).

## The idea

Someone preparing for a dated exam usually knows _what_ they have to cover. What
they do badly, especially when tired, is decide _when_. Comfortable topics get
revisited; large or unpleasant ones slide until there is no time left.

That allocation is a small optimisation problem. This application does it, and
redoes it after every completed or skipped session so the plan does not go stale
within a week.

**The rule, in one sentence:**

> The planner allocates each week's declared available minutes to study topics
> in descending order of an urgency score derived from priority, remaining
> minutes and days remaining until the deadline, and recomputes the allocation
> whenever a session is completed or skipped.

Concretely: urgency is the daily pace a topic would need to finish on time,
weighted by priority. Deadline pressure therefore beats mere importance, and
because urgency falls as remaining work shrinks, topics under similar pressure
interleave instead of one of them swallowing the week.

## What it does

- Email and password accounts; each learner's data is isolated in the database.
- Create, edit and delete study topics with an estimate, a priority and an
  optional deadline.
- Declare how many minutes are available on each weekday. Zero is meaningful.
- Generate a week of dated sessions, never exceeding a day's declared minutes.
- Mark a session done or skipped and watch topic progress follow.
- Regenerate a week without losing the record of what was already done.
- Add sessions directly to a monthly calendar; manual blocks survive regeneration.
- Find topics by name and filter unfinished or completed work.
- Start a 25-minute focus timer for the next session, pause it or reset it.
- Download planned sessions as an `.ics` calendar file with all-day entries.

## Stack

Astro 6 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL and
auth) · Vitest · Playwright · Cloudflare Workers

## Getting started

Requires Node 22 (see `.nvmrc`).

```bash
npm install
cp .env.example .env      # then fill in the two values below
npm run dev               # http://localhost:4321
```

`.env` needs a Supabase project:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon public key>
```

Create a project at [supabase.com](https://supabase.com), then apply **all** SQL
files in `supabase/migrations/` in filename order, including the manual-session
migration. Use the dashboard SQL editor or `npx supabase db push` against a linked
project. Applying only the initial schema leaves the calendar without its
required `manual` column.

Without these values the application still starts and renders a configuration
notice instead of crashing.

## Commands

| Command                 | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `npm run dev`           | development server                          |
| `npm run build`         | production build, Node adapter              |
| `npm run build:cf`      | production build, Cloudflare adapter        |
| `npm run start`         | serve the built application                 |
| `npm run lint`          | ESLint with type-checked rules              |
| `npm run test:unit`     | unit tests                                  |
| `npm run test:coverage` | unit tests with coverage thresholds         |
| `npm run test:e2e`      | end-to-end tests against a production build |

## Layout

```
src/domain/      the scheduling rule and its tests — pure, no I/O
src/lib/         repository, planning service, validation, Supabase client
src/pages/       routes and API endpoints
src/components/  React islands
supabase/        migrations
e2e/             Playwright specs
context/         project contracts: PRD, tech stack, infrastructure, test plan
```

The interesting file is `src/domain/scheduler.ts`. It is a pure function, which
is why it can be tested exhaustively without a database or a browser.

## Two build targets

The adapter is chosen by `DEPLOY_TARGET`: Node by default, Cloudflare when set
to `cloudflare`.

During bootstrap, the Cloudflare adapter's `workerd` process failed on the
development machine. This is why local work defaults to Node and CI verifies
both targets. On 2026-09-13, the Cloudflare build also succeeded locally on
Windows with Node 24.19.0. Both adapters are retained; the application code does
not depend on Cloudflare-specific APIs. CI continues to use the declared Node 22.

What was checked before settling on this is written down in
`context/foundation/infrastructure.md`.

## Testing

Unit tests cover the scheduling rule: capacity is never exceeded, large topics
are split rather than truncated, deadlines outrank priority, finished topics
stop being scheduled, and the same input always produces the same plan.

End-to-end tests cover the flow a learner actually walks, plus the property that
matters most — a second learner sees none of the first learner's data.

Reasoning behind the split, and what is deliberately left untested, is in
`context/foundation/test-plan.md`.

## Continuous integration

Every push and pull request to `main` runs lint, type checking, unit tests with
coverage thresholds, both build targets, and the end-to-end suite against a
Supabase instance started inside the runner.

Deployment is a separate, manually triggered workflow, so publishing is never a
side effect of merging. It needs four repository secrets: `SUPABASE_URL`,
`SUPABASE_KEY`, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Status and limitations

This is a course MVP, and the boundaries are deliberate.

- No mobile client, no sharing, no reminders, no content storage. The
  application decides what to study and for how long; it holds no material.
- Weeks run Monday to Sunday and are not configurable.
- A topic whose deadline has passed is treated as maximally urgent rather than
  archived. Whether that is the right default is still open.
- The week boundary follows the server clock, not the learner's timezone.
- The focus timer resets on navigation or refresh. It never records progress
  automatically; completion is an explicit action for the whole session.
- Calendar export is a downloaded snapshot, not live synchronization. Sessions
  have no start hour, so entries are all-day with the study duration in the title.
- Undo a completed session before deleting it, so topic progress stays accurate.

The full list of what was deliberately excluded is under "Non-goals" in
`context/foundation/prd.md`.
