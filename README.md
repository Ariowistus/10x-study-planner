# 10x Study Planner

A calendar and a completion checklist for personal study. Add a name, date,
start time and duration in **Kalendarz**, then check off the entry in
**Realizacja**. These are the only two workspace views.

Built as the course project for 10xDevs 3.0.

**Live application:** [10x Study Planner](https://10x-study-planner.ariowistus.workers.dev)

**Course submission:** [criteria audit and demo walkthrough](docs/submission-audit.md).

## What it does

- Email/password accounts with database row level security.
- Create, read, edit and delete entries directly in the calendar.
- Store a start hour and duration; keep old entries without an invented hour.
- Reject overlapping reservations, including concurrent submissions from two tabs.
- Record completion atomically and undo it before editing or deleting completed work.
- Summarize actual entries by name and by week, with search and status filters.
- Use an optional focus timer and download a weekly ICS snapshot.

The business rules include overlap detection, same-day duration constraints,
atomic completion bookkeeping, and progress calculated from the week's actual
entries. The original urgency-based generator remains covered in the domain
and through its compatibility API, but is no longer part of the everyday UI.

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

## Database upgrade for the two-view workspace

Apply `supabase/migrations/20260913150000_calendar_times.sql` before deploying
the calendar-first application. It only adds a nullable hour and a scoped
transactional write function. Existing entries are retained.

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
  with hours use floating local calendar times; untimed entries remain all-day.
- Undo a completed session before deleting it, so topic progress stays accurate.

The full list of what was deliberately excluded is under "Non-goals" in
`context/foundation/prd.md`.
