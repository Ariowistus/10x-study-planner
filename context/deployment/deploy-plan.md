# Deployment Plan — 10x Study Planner

- **Inputs**: `context/foundation/infrastructure.md`, `context/foundation/tech-stack.md`
- **Date**: 2026-09-10
- **Status**: executed

The plan was agreed before anything was published, and this file records both
what was intended and what actually happened, including the two places where
reality differed.

## Target

Cloudflare Workers, built and published from continuous integration, at
`https://10x-study-planner.ariowistus.workers.dev`. Supabase remains a managed
service and is not self-hosted.

## Steps and who owned them

| # | Step | Owner | Result |
| --- | --- | --- | --- |
| 1 | Create the Supabase project, apply the migration | human | done |
| 2 | Put the project URL and public key in `.env` | agent | done |
| 3 | Verify the schema through the REST API | agent | done |
| 4 | Run the full end-to-end suite against the real database | agent | done, ten of ten |
| 5 | Create the public GitHub repository and push | agent | done |
| 6 | Add the four repository secrets | agent, from values the human created | done |
| 7 | Create a Cloudflare account and a scoped API token | human | done |
| 8 | Run the deploy workflow | agent | done |
| 9 | Walk the whole user flow against production | agent | done |

The split matters: the agent never created an account, never chose a token
scope, and never held a credential outside the repository's secret store.

## Accounts and services needed

- Supabase project in the EU, free plan, with email confirmation switched off.
- Cloudflare account, free plan.
- GitHub repository with Actions enabled.

## Secrets

| Name | Where it lives | Used by |
| --- | --- | --- |
| `SUPABASE_URL` | GitHub secret, then a Worker secret | build and runtime |
| `SUPABASE_KEY` | GitHub secret, then a Worker secret | build and runtime |
| `CLOUDFLARE_API_TOKEN` | GitHub secret | the deploy job only |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub secret | the deploy job only |

The Cloudflare token was scoped to Workers on one account, with the template's
zone permission removed, so it cannot reach DNS, billing, or anything else.

## Commands the workflow runs

```
npm ci
npx astro sync
npm run build:cf
npx wrangler deploy
printf '%s' "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL
printf '%s' "$SUPABASE_KEY" | npx wrangler secret put SUPABASE_KEY
```

## Two things the plan got wrong

**Secrets were not attached to the Worker.** The first version of the workflow
built with the credentials and published, which is enough for a bundled value
but not for one the runtime reads from its own environment. Publishing alone
would have produced a live application that believed Supabase was not
configured. The workflow now syncs both secrets after the deploy, and the
ordering is deliberate: a secret cannot be attached to a Worker that does not
exist yet.

**The token needed a scope nobody mentioned.** Pushing the workflow files failed
because the GitHub token lacked `workflow`. Not a project problem, but it
belongs here, because the next person to publish this repository from a fresh
machine will hit it too.

## Verification performed

| Check | Result |
| --- | --- |
| Landing page responds | 200 |
| `/dashboard` while signed out | 302 to sign-in |
| Configuration notice absent | confirmed, so the runtime has its credentials |
| Register, plan a week, complete a session, see progress | passed against production |

The last row was run as the real end-to-end scenario against the public
address, not simulated.

## Rollback

```
npx wrangler deployments list
npx wrangler rollback <version-id>
```

Under a minute. It does not touch the database, and migrations are additive, so
a code rollback cannot strand the schema.

## What is deliberately not automated

Publishing is a manually triggered workflow rather than something that happens
on merge. Rotating a secret, deleting the Worker, and any destructive database
change stay with a human. The reasoning is in `infrastructure.md` under
permissions.
