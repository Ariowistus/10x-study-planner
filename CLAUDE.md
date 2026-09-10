# Rules for AI

Guidance for AI agents working in this repository. Project contracts live in
`context/foundation/`: `prd.md` (what and why), `tech-stack.md` (with what),
`infrastructure.md` (where it runs), and `lessons.md` (rules earned from real
mistakes — read it before planning).

## Commands

| Purpose | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Build (local, Node adapter) | `npm run build` |
| Build (production, Cloudflare) | `npm run build:cf` |
| Serve the built app | `npm run start` |
| Lint | `npm run lint` / `npm run lint:fix` |
| Type check | `npx astro check` |
| Unit tests | `npm run test:unit` |
| End-to-end tests | `npm run test:e2e` |

## Two build targets — do not remove one

`astro.config.mjs` picks its adapter from `DEPLOY_TARGET`: Node by default,
Cloudflare when it is set to `cloudflare`.

This is not an accident and not legacy. The Cloudflare adapter boots `workerd`
through miniflare during dev *and* build, and that runtime aborts on the
maintainer's Windows machine, so local work is impossible with it. CI builds
both targets on Linux, which is where the Cloudflare build is proven. The
reasoning and what was ruled out are recorded in `infrastructure.md`.

Consequence for anything you write: **no Cloudflare-only API**. No KV, no R2,
no Images binding, no `caches.default`. Anything that runs on one target has to
run on the other.

## Where things belong

- `src/domain/` — the scheduling rule and its types. **Pure**: no database, no
  network, no clock, no framework import. This is the only part of the codebase
  with real algorithmic content, and its purity is why it can be tested
  exhaustively. Keep it that way.
- `src/lib/repository.ts` — every database call. Nothing else talks to Supabase.
- `src/lib/planning.ts` — glue between the two: loads state, calls the domain,
  writes the result back.
- `src/lib/validation.ts` — Zod schemas. Every endpoint parses its input here
  before doing anything.
- `src/pages/api/` — thin. Authenticate, validate, delegate, redirect.

If you find yourself adding a date calculation or an allocation decision to a
page or an endpoint, it belongs in `src/domain/` with a test.

## Conventions that are not obvious from the code

- **Weekday 0 is Monday** everywhere: the `availability` table, the
  `Availability` tuple, `weekdayIndex()`. JavaScript's `getDay()` uses Sunday as
  0, so never pass it around unconverted.
- **Dates are `YYYY-MM-DD` strings, never `Date` objects**, once they leave
  `src/domain/date.ts`. The planner works in calendar days; a timezone shift
  that moves a session to the wrong evening is a real bug.
- **Forms, not fetch.** The UI posts ordinary HTML forms and the endpoints
  redirect back with `?ok=` or `?error=`. This keeps the app working without
  client JavaScript and makes the end-to-end tests stable. Do not convert these
  to client-side fetch calls without a reason.
- **HTML forms cannot send PATCH or DELETE**, so the intended verb arrives in an
  `_action` field. See `src/pages/api/topics/[id].ts`.
- **Session progress goes through `set_session_status`**, the Postgres function.
  Never update `sessions.status` and `topics.completed_minutes` as two separate
  writes: they would drift apart on a partial failure.
- **`src/lib/database.types.ts` is hand-written.** There is no code generation
  step. Change it in the same commit as any migration, or queries silently go
  back to `any` and the strict lint rules start failing in confusing places.

## Database

- Migrations live in `supabase/migrations/`, named `YYYYMMDDHHmmss_description.sql`.
- **Every new table needs row level security enabled and an ownership policy.**
  Learner isolation is a stated requirement (FR-007), not a nicety, and it is
  enforced in the database rather than in application code.
- Every learner-owned row carries `user_id`.
- Local database: `npx supabase start` (needs Docker; not available on the
  maintainer's machine, so this path is exercised in CI).

## Testing

- The scheduling rule is covered by unit tests in `src/domain/`. If you change
  its behaviour, change the tests deliberately — do not adjust an assertion to
  make a run go green.
- End-to-end tests in `e2e/` cover the user-visible flow and run against a
  production build.
- Test identifiers use `data-testid`. Keep them when editing markup.

## Environment

- Node 22 (`.nvmrc`).
- `SUPABASE_URL` and `SUPABASE_KEY`; copy `.env.example` to `.env`.
- The app still renders without them: `createClient` returns `null` and pages
  show a configuration message instead of crashing. Preserve that behaviour.

## CI

`.github/workflows/ci.yml` runs on `main`: lint, type check, unit tests with
coverage thresholds, both builds, and end-to-end tests against a Supabase
instance started in the runner. Deployment is a separate manually triggered
workflow.
