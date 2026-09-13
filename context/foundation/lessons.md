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

## Close every artefact that cited a blocker, in the session the blocker clears

- **Context**: Any change whose plan carries a manual verification gate, or whose
  roadmap item is `blocked` on external setup (an account, a hosted service, a
  deployment target).
- **Problem**: F-04 and F-05 landed on 2026-09-11. For a full day afterwards the
  roadmap still listed them as `blocked — needs an account`, its `top_blocker`
  field still read "No hosted database yet", `S-05` was still waiting on F-04,
  and the implementation review still closed with "the manual verification gate
  has not been walked, because there is no hosted database yet". Four statements
  across three documents, all false, all describing a project that was by then
  deployed and publicly reachable. Nothing catches this: the code was right, CI
  was green, and no gate reads the roadmap.
- **Rule**: When an external blocker clears, grep the context directory for the
  blocker's name before the session ends and close every artefact that cited it.
  An artefact that outlives its own premise reads as a defect in the project to
  anyone who opens it later.
- **Applies to**: plan, implement, impl-review

## A manual gate that nothing automates is a gate that never closes

- **Context**: Any plan phase whose verification is a human walk-through rather
  than an assertion — especially the final gate of a slice.
- **Problem**: The S-02 plan's manual gate ended with "confirm that regenerating
  does not resurrect the completed session". The behaviour is implemented
  correctly in `regenerateWeek`, which deletes only `planned` rows and subtracts
  settled minutes from the evening's capacity. But the domain unit tests cannot
  reach it — it is I/O — and `e2e/planner.spec.ts` stops one step earlier, after
  marking a session done. The single riskiest interaction in the slice, named
  explicitly by the plan as needing verification, was for two days the one
  thing no test touched. The assertion landed on 2026-09-12; the rule below is
  what keeps the next gate from lasting that long.
- **Rule**: When a plan names a manual verification step, decide in the same
  phase whether an automated assertion can carry it. If it can, write the
  assertion instead of the gate. A gate that survives to the end of a slice is a
  gap with a promise attached.
- **Applies to**: plan, plan-review, implement, impl-review

## A controlled number input in React will not drop a leading zero

- **Context**: Any React-controlled `input[type="number"]` whose value starts at
  a real number rather than empty — the weekday fields in
  `AvailabilityEditor.tsx` are the case in this project.
- **Problem**: A field showing `0` with the caret behind it turns typed input
  into `01`, `012`, `0120`. The state is correct — `Number.parseInt("0120")` is
  120, and the weekly total reads right — but the learner sees a field that
  looks broken and may retype or give up. React does not repair it, and this is
  deliberate on React's side: it compares a number input with
  `node.value != props.value`, a loose comparison under which `"0120"` and `120`
  are equal, so it concludes the DOM already shows the correct value. The
  browser does not repair it either, because `0120` is a valid number.
- **Rule**: For a controlled numeric field, select the contents on focus so
  typing replaces rather than appends, and write the normalised string back to
  the element in the change handler. Do not rely on React reconciling a number
  input — for this element it compares loosely by design.
- **Applies to**: plan, implement, impl-review

## Prove a regression test fails before trusting it

- **Context**: Any test written to cover a bug that was just found, especially
  end-to-end tests that drive an input.
- **Problem**: The first test written for the leading-zero bug used
  `locator.click()` followed by `keyboard.type()`. It passed — and it passed
  just as happily with the fix reverted, because Playwright's click lands in the
  middle of a wide field and the browser then replaces the content rather than
  appending to it. The test asserted a path the bug never took. Only a
  diagnostic run, printing the field value after each keystroke, showed that the
  caret has to be pushed to the end with `press("End")` for the defect to appear
  at all.
- **Rule**: After writing a regression test, revert the fix and watch the test
  fail. A test that passes in both states documents nothing and will not stop
  the bug from returning.
- **Applies to**: implement, tdd, e2e, impl-review
