-- ---------------------------------------------------------------------------
-- manual sessions — blocks the learner placed by hand
-- ---------------------------------------------------------------------------
--
-- Sessions are normally produced by the scheduling rule, and regenerating a
-- week deletes every session still marked `planned` before writing the new
-- allocation. A block the learner placed themselves must survive that: it is a
-- decision, not a suggestion. This flag is what separates the two.
--
-- Generation also has to treat a manual block as capacity already spent, the
-- same way it treats a session that was done or skipped, so it never
-- double-books an evening the learner has already committed.

alter table public.sessions
  add column if not exists manual boolean not null default false;

create index if not exists sessions_manual_idx on public.sessions (user_id, manual);
