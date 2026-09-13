-- Additive: existing sessions keep their date and an explicitly unknown hour.
alter table public.sessions add column start_time time;
alter table public.sessions add constraint sessions_time_within_day check (
  start_time is null or (
    extract(second from start_time) = 0 and
    extract(epoch from start_time) / 60 + minutes <= 1440
  )
);

-- One atomic calendar write, including implicit topic/weekly container creation.
-- INVOKER keeps RLS active. Serialize calendar writes per learner so two tabs
-- cannot both book the same slot after checking an initially empty calendar.
create or replace function public.save_calendar_session(
  p_title text, p_date date, p_start_time time, p_minutes integer,
  p_session_id uuid default null
)
returns public.sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_topic uuid;
  v_plan uuid;
  v_session public.sessions;
begin
  if v_user is null then raise exception 'Zaloguj się'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 200 then
    raise exception 'Wpisz nazwę zajęcia (do 200 znaków)';
  end if;
  if p_date is null or p_minutes is null or p_minutes not between 1 and 1440 then
    raise exception 'Podaj dzień i czas od 1 do 1440 minut';
  end if;
  if p_start_time is not null and (
    extract(second from p_start_time) <> 0 or
    extract(epoch from p_start_time) / 60 + p_minutes > 1440
  ) then raise exception 'Zajęcie musi zakończyć się do północy'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if p_session_id is not null then
    select * into v_session from public.sessions where id = p_session_id for update;
    if not found then raise exception 'Nie znaleziono zajęcia'; end if;
    if v_session.status = 'done' then
      raise exception 'Najpierw cofnij ukończenie zajęcia';
    end if;
  end if;

  if p_start_time is not null and exists (
    select 1 from public.sessions s
    where s.scheduled_date = p_date and s.start_time is not null
      and s.status <> 'skipped' and (p_session_id is null or s.id <> p_session_id)
      and extract(epoch from s.start_time) / 60 < extract(epoch from p_start_time) / 60 + p_minutes
      and extract(epoch from p_start_time) / 60 < extract(epoch from s.start_time) / 60 + s.minutes
  ) then raise exception 'Te godziny nakładają się na inne zajęcie. Wybierz wolny termin.'; end if;

  select id into v_topic from public.topics
    where lower(btrim(title)) = lower(btrim(p_title))
    order by created_at, id limit 1;
  if v_topic is null then
    insert into public.topics(user_id, title, estimated_minutes)
      values(v_user, btrim(p_title), p_minutes) returning id into v_topic;
  end if;
  insert into public.plans(user_id, week_start)
    values(v_user, p_date - (extract(isodow from p_date)::int - 1))
    on conflict(user_id, week_start) do update set generated_at = now()
    returning id into v_plan;

  if p_session_id is null then
    insert into public.sessions(user_id, topic_id, plan_id, scheduled_date, start_time, minutes, manual)
      values(v_user, v_topic, v_plan, p_date, p_start_time, p_minutes, true)
      returning * into v_session;
  else
    update public.sessions set topic_id = v_topic, plan_id = v_plan,
      scheduled_date = p_date, start_time = p_start_time, minutes = p_minutes, manual = true
      where id = p_session_id returning * into v_session;
  end if;
  return v_session;
end;
$$;
revoke execute on function public.save_calendar_session(text, date, time, integer, uuid) from public;
grant execute on function public.save_calendar_session(text, date, time, integer, uuid) to authenticated;
