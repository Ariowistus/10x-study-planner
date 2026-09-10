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
