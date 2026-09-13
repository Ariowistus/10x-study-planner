# Verification brief

Source: foundation/test-plan.md, scheduling correctness and persistence across
the main user flow. Seed: e2e/seed.spec.ts. Rules: CLAUDE.md, E2E section.

1. Topic edits must survive a form submission and full page reload. Searching
   may hide a topic but must not delete it. Assert stored title and estimate.
2. The focus timer must pause/reset without recording study progress. The
   exported calendar must describe the same saved sessions. Only explicit
   completion changes progress, and that change survives reload.
3. Deleting a completed session must not leave completed minutes without a
   session. Reject direct deletion, then allow undo through the atomic status
   function and subsequent deletion. Verify final progress is zero.

Auth, HTTP routes, Supabase and SSR remain real. Only the browser clock is
controlled for the timer. Use a unique account per test, authenticate via HTTP
and storageState, and remove that account's topics after each test. Hosted
test auth accounts remain; CI destroys its local Supabase stack.

Deliberate-break checks: temporarily disable the topic update, change the timer
duration to 26 minutes, and remove the completed-session delete guard. Require
each test to fail at the intended assertion. Restore production code immediately
in a finally block, then run the genuine implementations again.
