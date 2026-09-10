# Setup — from an empty account to a public address

Everything the project needs that cannot be created from inside the repository.
Two free accounts, six values. Nothing here costs money.

Work through it in order; each step produces a value the next one needs.

---

## 1. Supabase — the database

The application cannot do anything without this. Do it first.

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
   - **Region**: choose the one nearest you. Frankfurt for central Europe.
   - **Database password**: generated is fine. Save it, though nothing here needs
     it again.
   - The project takes a couple of minutes to provision.

2. Apply the schema. Open **SQL Editor** in the project, paste the entire
   contents of `supabase/migrations/20260910120000_initial_schema.sql`, and run
   it. It creates four tables, their row level security policies, and the
   `set_session_status` function.

   Confirm it worked: **Table Editor** should list `topics`, `availability`,
   `plans` and `sessions`, each showing that row level security is enabled.

3. Collect two values from **Project Settings → API**:

   | Value | Where it appears |
   | --- | --- |
   | Project URL | `https://<ref>.supabase.co` |
   | `anon` public key | the key labelled **anon**, not `service_role` |

   The `anon` key is meant to be shipped to browsers; row level security is what
   protects the data. **Never** put the `service_role` key in this project — it
   bypasses every policy.

4. Put them in `.env` locally:

   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_KEY=<anon key>
   ```

   `npm run dev` should now let you register an account and reach the dashboard.

### One setting worth changing while you are there

Under **Authentication → Sign In / Providers → Email**, decide whether to
require email confirmation. Leaving it on is more realistic; turning it off
makes demonstrating the application to someone else considerably less awkward,
because a fresh account works immediately.

---

## 2. GitHub — the repository and its secrets

1. Push the repository. From the project directory:

   ```bash
   gh auth switch --user <account>
   gh repo create 10x-study-planner --public --source=. --remote=origin --push
   ```

2. Add four repository secrets under **Settings → Secrets and variables →
   Actions**:

   | Secret | Value |
   | --- | --- |
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_KEY` | from step 1 |
   | `CLOUDFLARE_API_TOKEN` | from step 3 below |
   | `CLOUDFLARE_ACCOUNT_ID` | from step 3 below |

   The first push runs the full pipeline: lint, type checking, unit tests, both
   builds, and the end-to-end suite against a Supabase instance the runner
   starts itself. That suite does **not** use the two Supabase secrets above —
   it runs against its own throwaway database, so it works even before you have
   finished this page.

---

## 3. Cloudflare — the public address

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up). The
   free plan is enough.

2. **Account ID**: open **Workers & Pages**. The account ID is shown in the
   right-hand column of that page. Copy it.

3. **API token**: go to **My Profile → API Tokens → Create Token**, and use the
   **Edit Cloudflare Workers** template.

   Narrow it before saving:
   - **Account resources**: this account only.
   - **Zone resources**: none. The project does not touch DNS.

   Copy the token immediately; it is shown once.

   Scope matters. A token limited to Workers cannot change your DNS, cannot see
   billing, and cannot reach anything else on the account, so leaking it costs
   you one Worker rather than a domain.

4. Put both values into the GitHub secrets from step 2.

5. Deploy: **Actions → Deploy → Run workflow**. It builds the Cloudflare target,
   publishes, then attaches the Supabase credentials as Worker secrets.

   Your address will be:

   ```
   https://10x-study-planner.<your-subdomain>.workers.dev
   ```

   The workflow prints the deployment list at the end; the address also appears
   in the dashboard under **Workers & Pages → 10x-study-planner**.

### If the first run looks wrong

A secret cannot be attached to a Worker that does not exist yet, so on the very
first deploy the Worker goes live for a few seconds before its credentials
arrive. If you open it in that window it shows the "not configured" notice.
Reload, or run the workflow once more. Later deploys do not have this gap,
because the secrets are already there.

---

## 4. Verify

| Check | Expected |
| --- | --- |
| Open the public address | the landing page loads |
| Open `/dashboard` while signed out | redirected to sign-in |
| Register, then sign in | you reach an empty dashboard |
| Add a topic, set availability, generate a plan | dated sessions appear, never exceeding a day's declared minutes |
| Mark a session done | topic progress moves |
| Register a second account | it sees none of the first account's data |

The last row is the one worth doing by hand even though a test covers it. It is
the only failure in this project that would matter to someone other than you.

---

## Rolling back

```bash
npx wrangler deployments list
npx wrangler rollback <version-id>
```

Under a minute, and it does not touch the database. A code rollback will not
undo a schema migration, which is why migrations here only add.
