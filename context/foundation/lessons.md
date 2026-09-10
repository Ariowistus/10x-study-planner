# Lessons Learned

Rules earned from real problems in this project, appended in the order they were
found. This file grows by addition; earlier entries are not rewritten.

## Do not assume the recommended runtime starts on the development machine

- **Context**: Project bootstrap, before any feature work.
- **Problem**: The Cloudflare adapter boots `workerd` through miniflare during
  both `astro dev` and `astro build`. On this Windows machine it aborts with an
  access violation, so the entire local loop was dead before a single line of
  application code existed. The current Visual C++ redistributable, a
  non-ASCII-free path, and disabling `platformProxy` were all ruled out.
- **Rule**: Verify that `npm run dev` and `npm run build` actually complete
  before building anything on top of a starter. If the production runtime cannot
  run locally, split the build target and record why, rather than losing days to
  a toolchain that is not the point of the work.
- **Applies to**: plan, implement

## Never let a lint or test result be masked by a pipe

- **Context**: Verifying a commit from the shell.
- **Problem**: `npm run lint | grep -v noise && git commit` reported success and
  committed code with twelve formatting errors, because the exit status came
  from `grep`, not from the linter.
- **Rule**: Capture the command's own exit code before filtering its output:
  run the command, save `$?`, then grep the saved log. Never chain a gate to a
  commit through a pipeline.
- **Applies to**: implement, impl-review

## Let the type system make the guard real, or delete the guard

- **Context**: Writing the Supabase repository layer.
- **Problem**: Defensive `if (!row)` checks after `.select()` were flagged as
  unreachable once the client was typed, because TypeScript treats indexing an
  array as always defined. The checks were noise pretending to be safety.
- **Rule**: When a null check is dead code, do not silence the rule. Either use
  an API whose type admits the empty case — `.single()` or `.maybeSingle()` —
  or remove the check. A guard the compiler proves cannot fire is a comment
  wearing a costume.
- **Applies to**: implement, impl-review

## Keep the domain rule free of I/O

- **Context**: Designing the planner.
- **Problem**: The scheduling rule is the only part of this codebase with real
  content, and it produces plausible-looking wrong answers when it breaks. Had
  it been written inside an endpoint, every test of it would have needed a
  database, a session and a clock.
- **Rule**: Algorithmic decisions live in `src/domain/` as pure functions taking
  plain data. No database, no network, no `new Date()` inside the rule. The cost
  is one mapping layer; the return is exhaustive tests that run in milliseconds.
- **Applies to**: frame, plan, implement

## Write the schema types in the same commit as the migration

- **Context**: Typing the Supabase client.
- **Problem**: `src/lib/database.types.ts` is hand-written, with no generation
  step. If a migration lands without it, queries silently degrade to `any` and
  the strict lint rules start failing in files that were never touched.
- **Rule**: A migration and the matching change to `database.types.ts` are one
  commit, never two.
- **Applies to**: implement, impl-review

## `step` on a number input silently blocks the form

- **Context**: HTML forms with `<input type="number">`, anywhere in the app.
- **Problem**: The estimate field had `min="1"` and `step="5"`. The browser
  counts valid values from the minimum, so it accepted 1, 6, 11 and so on. The
  form's own default of 120 was invalid, and clicking the submit button did
  nothing at all — no request, no message, no visible reason. It cost a long
  debugging session because every layer looked healthy.
- **Rule**: Use `step="1"` on a number input unless a coarser step is a real
  domain constraint. If it is, make `min` a multiple of it. Never assume a
  submit button that appears to do nothing means the click was missed.
- **Applies to**: implement, impl-review

## A test that reuses a stale server is testing nothing

- **Context**: Playwright with `reuseExistingServer`.
- **Problem**: A development server left running from hours earlier was picked
  up by the test run. The suite reported real-looking failures against code that
  was not the code under test, and the production build path was never
  exercised.
- **Rule**: When end-to-end results are confusing, check what is actually
  answering on the port before debugging the application. A `[vite] connecting`
  line in the browser console means a development server, not the build.
- **Applies to**: implement, impl-review

## Wait for hydration before typing into an island

- **Context**: End-to-end tests against Astro islands with React.
- **Problem**: Filling a controlled input before its island hydrated looked
  successful, then React mounted with its initial empty state and discarded the
  input. The failure surfaced as "Email is required" on a form that had visibly
  been filled.
- **Rule**: Wait until no `astro-island[ssr]` remains before typing into a
  React-controlled field, and assert the value survived the fill.
- **Applies to**: implement, impl-review

## A deadline is a cliff, but required pace treats it as a slope

- **Context**: The urgency rule in `src/domain/scheduler.ts`.
- **Problem**: A topic due tomorrow with a quarter of an hour left can be
  outranked by a much larger topic due in a month, because required daily pace
  is all that is compared. The urgent topic then ends the evening unfinished
  even though there was room for it.
- **Rule**: Treat this as a known property of the current rule, not a defect to
  patch in a hurry. If it is ever changed, the fix belongs in the score itself —
  risk of missing a deadline — and needs its own tests, not a special case in
  the allocation loop.
- **Applies to**: frame, plan, impl-review
