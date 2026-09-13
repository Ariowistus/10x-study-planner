# Calendar-first study tracker

User decision, 2026-09-13: two navigation destinations, Realizacja first and
Kalendarz second. No separate topic setup, availability setup or plan generation
in the everyday UI. Calendar entries are the checklist items on the dashboard.

Design: retain surface #faf9f7, raised #ffffff, ink #1a1815, muted #6f6a63,
brand #0f6b5c and brand-soft #e8f2ef with the existing dark equivalents.
Geist headings/body and Geist Mono times. Signature: a chronological checklist
with a dedicated time column and large completion controls. Calendar uses a
compact month selector beside a readable day agenda and one entry form, instead
of squeezing editing forms into seven narrow day columns. On phones the month
sits above the day agenda. No new decorative visual system.

Data: retain all existing topics/sessions. Add nullable start_time; old entries
remain explicitly untimed. A security-invoker RPC atomically creates/edits an
entry and its topic/plan, with ownership, duration and overlap validation.
Completed entries require undo before editing/deletion. Progress in Realizacja
uses actual scheduled/completed minutes in the selected week, so repeated names
do not reach 100% after only the first block. Keep domain planner and legacy APIs
for compatibility and their rule coverage; remove their obsolete UI workflows.

Verification: unit tests for summary/timing/export; browser tests for calendar
CRUD, persistence, two-view navigation, completion/undo, overlap rejection,
cross-account isolation and focus timer. Update obsolete UI tests to the new
user journey, retain generator coverage through its API. Both adapter builds,
lint/types and CI remain required. Apply additive migration before production.

## Verification results, 2026-09-13

- 63 domain unit tests passed; coverage 99.24% statements, 92.95% branches,
  100% functions, 99.18% lines. Lint passed; Astro check: zero errors/warnings.
- Node and Cloudflare builds passed locally and in CI on Node 22.
- [CI for release 1502ecd](https://github.com/Ariowistus/10x-study-planner/actions/runs/34763062532)
  passed all 25 functional browser scenarios and two screenshot-generation runs.
- CI applied all three migrations to a fresh Supabase database. Tests confirmed
  hour persistence, atomic overlap rejection, simultaneous reservation rejection,
  CRUD, completion/undo and cross-account access protection.
- Desktop 1280px and mobile 390px screenshots inspected in light/dark themes.
  Final CSS prevents a long topic name from splitting its adjacent percentage.
- Backward compatibility also tested locally against the existing hosted schema:
  old generated sessions appear without hours and completing/regenerating keeps
  their history. This test caught and verified the fix for the select rendering
  defect, documented in lessons.md.

## Production deployment — 2026-09-13

**Calendar-first is deployed** at
[Study Planner](https://10x-study-planner.ariowistus.workers.dev/dashboard).
Application release: `1502ecd88228777b0ca2d13f016c83e292ad96cf`.
[Successful deployment](https://github.com/Ariowistus/10x-study-planner/actions/runs/34763678972).

After the owner signed in to Supabase, migration
`supabase/migrations/20260913150000_calendar_times.sql` was applied through the
SQL Editor to the existing project, wrapped in a single transaction. Schema
checks confirmed the new column and function before publishing the application.
Existing study records were retained. This was a manual SQL migration, not a
Supabase CLI migration-history update.

Six browser scenarios passed against the public Cloudflare URL after deployment:
calendar CRUD with hour edits and reload/search; completion protection and undo;
focus timer and ICS export; two-view navigation and old bookmarks; overlap
rejection with adjacent bookings allowed; and concurrent reservation rejection.
Each scenario used its own account and cleaned up its own study topics/sessions.
No application-code changes followed these production checks.
