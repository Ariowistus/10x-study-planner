-- 10x Study Planner — initial schema
--
-- Four tables implement the PRD data model. Every learner-owned row carries
-- user_id, which lets row level security express the ownership rule (FR-007)
-- as a direct comparison against the authenticated user.

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------

create table if not exists public.topics (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null check (char_length(btrim(title)) between 1 and 200),
  estimated_minutes integer not null check (estimated_minutes > 0 and estimated_minutes <= 100000),
  completed_minutes integer not null default 0 check (completed_minutes >= 0),
  priority          smallint not null default 3 check (priority between 1 and 5),
  deadline          date,
  status            text not null default 'active' check (status in ('active', 'done', 'archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists topics_user_id_idx on public.topics (user_id);
create index if not exists topics_user_status_idx on public.topics (user_id, status);

-- ---------------------------------------------------------------------------
-- availability — minutes per weekday, 0 is Monday
-- ---------------------------------------------------------------------------

create table if not exists public.availability (
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  minutes integer not null default 0 check (minutes >= 0 and minutes <= 1440),
  primary key (user_id, weekday)
);

-- ---------------------------------------------------------------------------
-- plans — one generated week per learner
-- ---------------------------------------------------------------------------

create table if not exists public.plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  week_start   date not null,
  generated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- sessions — a dated block of work on one topic
-- ---------------------------------------------------------------------------

create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  plan_id        uuid not null references public.plans (id) on delete cascade,
  topic_id       uuid not null references public.topics (id) on delete cascade,
  scheduled_date date not null,
  minutes        integer not null check (minutes > 0),
  status         text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists sessions_user_date_idx on public.sessions (user_id, scheduled_date);
create index if not exists sessions_plan_idx on public.sessions (plan_id);
create index if not exists sessions_topic_idx on public.sessions (topic_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists topics_touch_updated_at on public.topics;
create trigger topics_touch_updated_at
  before update on public.topics
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: a learner reads and writes only their own rows.
-- ---------------------------------------------------------------------------

alter table public.topics       enable row level security;
alter table public.availability enable row level security;
alter table public.plans        enable row level security;
alter table public.sessions     enable row level security;

drop policy if exists topics_owner_access on public.topics;
create policy topics_owner_access on public.topics
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists availability_owner_access on public.availability;
create policy availability_owner_access on public.availability
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists plans_owner_access on public.plans;
create policy plans_owner_access on public.plans
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists sessions_owner_access on public.sessions;
create policy sessions_owner_access on public.sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- set_session_status
--
-- Changing a session's status also moves the parent topic's progress. Doing
-- both in one function keeps the two consistent: a failure leaves neither
-- changed. Security is INVOKER, so row level security still applies and a
-- learner cannot touch another learner's session through this function.
-- ---------------------------------------------------------------------------

create or replace function public.set_session_status(p_session_id uuid, p_status text)
returns public.sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.sessions;
  v_delta   integer;
begin
  if p_status not in ('planned', 'done', 'skipped') then
    raise exception 'invalid session status: %', p_status using errcode = '22023';
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if v_session.status = p_status then
    return v_session;
  end if;

  -- Minutes count towards a topic only while the session is marked done, so the
  -- delta is the difference between the new and the old contribution.
  v_delta := (case when p_status = 'done' then v_session.minutes else 0 end)
           - (case when v_session.status = 'done' then v_session.minutes else 0 end);

  update public.sessions
     set status = p_status,
         completed_at = case when p_status = 'done' then now() else null end
   where id = p_session_id
  returning * into v_session;

  if v_delta <> 0 then
    update public.topics
       set completed_minutes = greatest(0, completed_minutes + v_delta)
     where id = v_session.topic_id;

    -- A topic that reached its estimate stops being scheduled; one that fell
    -- back below it becomes active again.
    update public.topics
       set status = case when completed_minutes >= estimated_minutes then 'done' else 'active' end
     where id = v_session.topic_id
       and status <> 'archived';
  end if;

  return v_session;
end;
$$;
