# Bootstrap Verification

**Follow-up, 2026-09-13:** the Cloudflare build succeeded locally on Windows /
Node 24.19.0. The failure recorded here is the original bootstrap result; it
does not block the submission build. Both adapters remain supported.

- **Date**: 2026-09-10
- **Starter**: `przeprogramowani/10x-astro-starter`
- **Target**: `context/foundation/tech-stack.md`

Report from standing the project up, kept as a file rather than left in a chat
so the reasons are still available later.

## Phase 1 — pre-scaffold

| Check                 | Status     | Note                                                                           |
| --------------------- | ---------- | ------------------------------------------------------------------------------ |
| Starter is current    | **passed** | Astro 6, React 19, Tailwind 4, Supabase SSR, all on current majors             |
| Starter provides auth | **passed** | sign-in, sign-up, sign-out, middleware route protection                        |
| Starter provides CI   | **passed** | a GitHub Actions workflow exists; extended later                               |
| Toolchain present     | **passed** | Node 24.19, npm 11.17, git 2.53, GitHub CLI 2.86                               |
| Docker present        | **failed** | not installed; a local Supabase stack is therefore unavailable on this machine |

Docker being absent is why the end-to-end suite runs its database in CI rather
than locally.

## Phase 2 — scaffold

The starter was cloned rather than generated, since it is itself the
authoritative starting point for this course. Its git history was removed and a
fresh repository initialised, so the project owns its own history.

| Step                    | Status     | Note                                                                              |
| ----------------------- | ---------- | --------------------------------------------------------------------------------- |
| Clone                   | **passed** | 49 files                                                                          |
| `npm install`           | **warned** | npm withheld five install scripts pending approval                                |
| Approve install scripts | **passed** | `esbuild`, `sharp`, `supabase`, `workerd` approved and recorded in `package.json` |
| Rename project          | **passed** | `package.json`, `wrangler.jsonc`, `supabase/config.toml`                          |

The withheld scripts mattered: without them `esbuild` and `workerd` have no
binaries and no build can run at all.

## Phase 3 — post-scaffold

| Check                        | Status     | Note                                                                       |
| ---------------------------- | ---------- | -------------------------------------------------------------------------- |
| `astro sync`                 | **passed** |                                                                            |
| `astro check`                | **passed** | 0 errors                                                                   |
| `npm run lint`               | **passed** | after fixes described below                                                |
| `npm run build` (Node)       | **passed** |                                                                            |
| `npm run build` (Cloudflare) | **failed** | see below                                                                  |
| `npm audit`                  | **warned** | 27 advisories reported, 2 critical, all in the transitive development tree |
| Dev server smoke test        | **passed** | `/` 200, `/auth/signin` 200, `/dashboard` 302 to sign-in                   |
| Playwright pipeline          | **passed** | build, serve, browser and the access-control specs all run locally         |

### The Cloudflare build failure

`npm run build` with the Cloudflare adapter aborts before compiling:

```
There was an access violation in the runtime.
The Workers runtime failed to start.
  at Miniflare#assembleAndUpdateConfig
```

Ruled out, in order:

1. The Visual C++ redistributable, which the error message itself blames, is
   current at 14.44.
2. The `workerd` binary runs on its own; `workerd.exe --version` succeeds.
3. The non-ASCII character in the project path is not the cause; the failure
   reproduces identically from `C:\dev\10x-study-planner`.
4. Disabling `platformProxy` and the Cloudflare image service does not help,
   because the adapter also drives `workerd` through Vite's environment API.

The remaining likely explanation is endpoint protection on this managed machine.
That is outside what this project can fix, so the adapter is now selected by
`DEPLOY_TARGET` and the Cloudflare build is produced in CI. The full record,
including the risk accepted, is in `context/foundation/infrastructure.md`.

### Adapter version alignment

Adding the Node adapter needed two attempts. The current release requires Astro
7, and the 10.x line expects an Astro 6.4 API that the pinned 6.3.1 did not
export. Astro was upgraded to 6.4.8 to match `@astrojs/node@10.1.4`, after which
the build succeeded.

### Dependency advisories

`npm audit` reports 27 advisories, two of them critical. All sit in the
development dependency tree that the starter brings in, none in the runtime path
that reaches production. They are not addressed here because `npm audit fix
--force` would move major versions of build tooling four days before a deadline.
This is a deliberate deferral, not an oversight, and it is the one item on this
page that should be revisited after submission.

## Outstanding

| Item                                  | Blocked on                                     |
| ------------------------------------- | ---------------------------------------------- |
| Apply the schema migration            | a Supabase project                             |
| Run the full end-to-end suite locally | the same, or Docker                            |
| First deployment                      | a Cloudflare account and API token             |
| Course skill packs                    | clicking the sign-in link the course CLI sends |
