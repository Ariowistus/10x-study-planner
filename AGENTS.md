# Repository Guidelines

10x Study Planner turns a topic list, an exam date and a weekly evening budget into dated study sessions. Astro 6, React 19 and TypeScript on Supabase, served from Cloudflare Workers. Depth lives in @CLAUDE.md; the product and platform contracts in @context/foundation/.

## Hard rules

- **No Cloudflare-only API.** No KV, no R2, no Images binding, no `caches.default`. `astro.config.mjs` picks its adapter from `DEPLOY_TARGET` and both targets must keep building — reasoning in @context/foundation/infrastructure.md.
- **Weekday 0 is Monday** in the `availability` table, the `Availability` tuple and `weekdayIndex()`. Never pass `Date.getDay()` on unconverted.
- **Dates are `YYYY-MM-DD` strings** once they leave `src/domain/date.ts`, never `Date` objects.
- **Session progress goes through the `set_session_status` Postgres function.** Never write `sessions.status` and `topics.completed_minutes` as two statements.
- **`src/lib/database.types.ts` is hand-written** — there is no generation step. Change it in the same commit as the migration.
- **Every new table gets row level security and an ownership policy** (FR-007) and every learner-owned row carries `user_id`.
- Read @context/foundation/lessons.md before planning anything.

## Project structure

`src/domain/` holds the scheduling rule and stays pure: no database, network, clock or framework import. `src/lib/repository.ts` owns every Supabase call, `src/lib/planning.ts` is the glue, `src/lib/validation.ts` the Zod schemas. Endpoints in `src/pages/api/` stay thin — authenticate, validate, delegate, redirect. A date calculation or an allocation decision belongs in `src/domain/` with a test. Migrations: `supabase/migrations/YYYYMMDDHHmmss_description.sql`.

## Build, test and development commands

Node 22 (@.nvmrc). `npm run dev` to serve, `npm run lint`, `npx astro check`, `npm run test:unit`, `npm run test:e2e`, `npm run build` for the Node target and `npm run build:cf` for Cloudflare. Full list: @package.json.

## Conventions

Forms, not fetch: the UI posts ordinary HTML forms and endpoints redirect back with `?ok=` or `?error=`, which is what keeps the app working without client JavaScript. HTML forms cannot send PATCH or DELETE, so the intended verb arrives in an `_action` field. Keep `data-testid` attributes when editing markup.

## Testing

Vitest unit tests sit next to the code in `src/domain/` under coverage thresholds (@vitest.config.ts); Playwright specs in `e2e/` run against a production build (@playwright.config.ts). Never loosen an assertion to green a run.

## Commits and CI

Conventional Commits, as in `git log`: `feat:`, `fix(db):`, `ci:`, `docs:`, `test:`, `chore:`. @.github/workflows/ci.yml gates `main` on lint, type check, unit coverage, both builds and E2E. Deploy is a separate manual workflow: @.github/workflows/deploy.yml.
