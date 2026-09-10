# Infrastructure — 10x Study Planner

- **Inputs**: `context/foundation/tech-stack.md`, `context/foundation/prd.md`
- **Date**: 2026-09-10

This file is the architectural decision record for where and how the project
runs. It is written to be re-read later, when the reasons behind a choice are no
longer obvious.

---

## Choice and rationale

**Production target: Cloudflare Workers, built and deployed from continuous
integration.**

The application is a small server-rendered site with no long-running processes,
no background jobs and no large media handling. Its only stateful dependency is
Supabase, reached over HTTPS from the server. That profile fits an edge runtime
without compromise, and Astro ships a first-party Cloudflare adapter, so the
path from repository to public URL is short and well documented.

Cloudflare also scores well on the criterion that matters for this course: an
agent can operate it entirely from a terminal through `wrangler`, and there is a
maintained MCP server if terminal access is ever unavailable.

## Stack fit

| Concern | Fit |
| --- | --- |
| Rendering | server-side rendering on request, which the adapter supports natively |
| Runtime | `workerd`; the application uses only web-standard APIs plus the Supabase SDK |
| Database | Supabase over HTTPS, no direct TCP connection needed, so no connection pooling problem at the edge |
| Static assets | served by the Workers assets binding configured in `wrangler.jsonc` |
| Build | produced on Linux in CI, never on the developer machine |

## Known constraint: the local runtime does not start

`workerd` cannot be started through miniflare on the development machine used
for this project. Both `astro dev` and `astro build` fail at
`Miniflare#assembleAndUpdateConfig` with:

```
There was an access violation in the runtime.
The Workers runtime failed to start.
```

What was checked and ruled out:

- The Visual C++ redistributable is current (14.44), which is the cause the
  error message itself suggests.
- The `workerd` binary runs on its own: `workerd.exe --version` succeeds.
- The non-ASCII character in the project path was not responsible; the failure
  reproduces identically from `C:\dev\10x-study-planner`.
- Disabling `platformProxy` and the Cloudflare image service did not help,
  because the adapter also drives `workerd` through Vite's environment API.

The most likely remaining explanation is endpoint protection on this managed
Windows machine interfering with the runtime's process or socket setup. That is
not something this project can resolve, and diagnosing it further is not a good
use of the remaining time.

**Consequence.** The adapter is chosen at build time:

```js
adapter: process.env.DEPLOY_TARGET === "cloudflare" ? cloudflare() : node(...)
```

Local development and local testing use the Node adapter. Continuous
integration builds both targets, so a Cloudflare-specific build break is caught
on every push rather than at deploy time.

**Risk accepted.** The two builds share all application code and differ only in
the server entrypoint, and the application uses no Cloudflare binding. The
residual risk is a runtime difference that only appears in `workerd`. It is
mitigated by building the Cloudflare target in CI and by keeping the deployed
surface small. If it ever bites, the fallback is a Node host, which needs one
environment variable changed and no code rewritten.

## Continuous integration and delivery

Pipeline on every push and pull request:

1. install dependencies from the lockfile
2. `astro sync`
3. lint
4. unit tests
5. Node build
6. Cloudflare build
7. end-to-end tests against a Supabase instance started in the runner

Deployment to production is a separate, manually triggered job so that
publishing stays a deliberate act rather than a side effect of merging.

## Secrets

| Secret | Where it lives | Used by |
| --- | --- | --- |
| `SUPABASE_URL` | GitHub Actions secret; Workers secret in production | build and runtime |
| `SUPABASE_KEY` | GitHub Actions secret; Workers secret in production | build and runtime |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | deployment job only |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secret | deployment job only |

Local values live in `.env`, which is not tracked. `.env.example` documents the
names without values. The Cloudflare API token is scoped to Workers for this one
project: no DNS, no billing, no access to other projects.

## Preview deployments

Pull requests do not publish. A reviewer runs the branch locally or reads the CI
result. For a single-maintainer project, per-pull-request preview environments
cost more setup than they return.

## Rollback

Cloudflare keeps previous versions of a Worker. Rolling back is one command and
takes under a minute:

```
npx wrangler deployments list
npx wrangler rollback <version-id>
```

Because the database lives in Supabase, a code rollback does not undo a schema
migration. Migrations are therefore written to be additive, and a destructive
migration would need its own considered reversal.

## Permissions

| Action | Who |
| --- | --- |
| run tests, lint, build | agent, freely |
| write and apply migrations locally | agent, with review |
| publish to production | human, deliberately |
| rotate a secret | human only |
| delete a project, drop a database | human only |

## Risks

Recorded from the anti-bias pass over this decision.

1. **The local runtime failure is unresolved, not fixed.** Working around it is
   acceptable now, but it means the production runtime is never exercised on the
   development machine. CI is the only place the Cloudflare build is proven.
2. **Free tier limits.** Workers' free tier is generous for this workload but
   has a daily request ceiling. Irrelevant for a course project, relevant if the
   app is ever shared widely.
3. **Supabase free tier pauses inactive projects.** A project untouched for a
   week can be paused, which would make a demo fail at exactly the wrong moment.
   Worth a manual visit before any presentation.
4. **Two build targets, one test surface.** Unit tests do not run in `workerd`.
   A difference in runtime behaviour would surface only in the end-to-end tests
   or in production.
5. **Region.** Data lives in the Supabase region chosen at project creation.
   For a personal learning tool this carries no compliance weight, but it is a
   decision that is awkward to change later.

## Technical decisions

- **Region**: EU (Frankfurt) for Supabase, matching the maintainer's location.
- **Runtime**: `workerd` in production, Node 22 locally and in CI.
- **Plan**: free tier on both Cloudflare and Supabase.

## What would change this decision

- A need for long-running or scheduled work would push towards a Node host or a
  separate worker with cron triggers.
- A second maintainer on a machine where `workerd` runs normally would remove
  the reason for the dual-adapter arrangement.
- Direct PostgreSQL access, rather than the Supabase HTTP SDK, would make an
  edge runtime a poor fit and argue for a Node deployment.
