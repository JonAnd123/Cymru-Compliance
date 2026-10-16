-- ==========================================================================
-- 05_alerts_grouptraining.sql
--  * alert_prefs  : each user's e-mail reminder opt-out
--  * alert_log    : which reminders have already been e-mailed (de-duplication)
--  * alerts_due() : server-side list of reminders to send (service role only)
--  * alerts_mark_sent() : record reminders as sent (service role only)
--  * guard trigger: a training assignment's person must belong to its practice
-- Run once in the Supabase SQL editor, after 01–04.
-- ==========================================================================

create table if not exists public.alert_prefs (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email_digest boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.alert_prefs enable row level security;
drop policy if exists alert_prefs_self on public.alert_prefs;
create policy alert_prefs_self on public.alert_prefs for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table if not exists public.alert_log (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (profile_id, key)
);
alter table public.alert_log enable row level security;   -- no policies: service role only

-- a training assignment must be for someone who belongs to that practice
create or replace function public.training_assign_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;            -- SQL editor / service role
  if not exists (select 1 from public.profiles p
                 where p.id = new.profile_id and p.practice_id = new.practice_id and p.active) then
    raise exception 'assignee must be an active member of the practice';
  end if;
  return new;
end $$;
drop trigger if exists training_assign_guard on public.training_assignments;
create trigger training_assign_guard before insert on public.training_assignments
  for each row execute function public.training_assign_guard();

-- --------------------------------------------------------------------------
-- alerts_due: one row per (recipient, item, threshold) not yet e-mailed.
-- Recipients: principals and practice managers (practice-wide items) and
-- staff (their own evidence and training). Honours alert_prefs.
-- Thresholds: 60, 30, 14, 0 days before, and 'expired' (-1).
-- --------------------------------------------------------------------------
create or replace function public.alerts_due(p_window int default 60)
returns table (profile_id uuid, email text, full_name text, language text, practice_id uuid, practice_name text,
               kind text, title text, who text, due_date date, days_left int, key text)
language sql stable security definer set search_path = public as $$
  with items as (
    select e.practice_id, 'evidence'::text as kind, e.title, coalesce(sp.full_name,'') as who, e.expiry_date as due,
           e.staff_member as owner, 'ev:'||e.id||':'||e.expiry_date as base, true as practice_wide
      from public.evidence e left join public.profiles sp on sp.id = e.staff_member
     where e.expiry_date is not null and e.status <> 'rejected'
    union all
    select h.practice_id, 'gdc', 'GDC registration', h.full_name, h.gdc_expiry, null, 'hr:'||h.id||':gdc:'||h.gdc_expiry, true
      from public.hr_staff h where h.active and h.gdc_expiry is not null
    union all
    select h.practice_id, 'indemnity', 'Indemnity', h.full_name, h.indemnity_expiry, null, 'hr:'||h.id||':indemnity:'||h.indemnity_expiry, true
      from public.hr_staff h where h.active and h.indemnity_expiry is not null
    union all
    select h.practice_id, 'dbs', 'DBS', h.full_name, h.dbs_expiry, null, 'hr:'||h.id||':dbs:'||h.dbs_expiry, true
      from public.hr_staff h where h.active and h.dbs_expiry is not null
    union all
    select a.practice_id, 'training', m.title_en, ap.full_name, a.due_date, a.profile_id, 'tr:'||a.id||':'||a.due_date, true
      from public.training_assignments a
      join public.training_modules m on m.id = a.module_id
      join public.profiles ap on ap.id = a.profile_id
     where a.status <> 'completed' and a.due_date is not null and a.due_date <= current_date + 14
  ), banded as (
    select i.*, (i.due - current_date) as dl,
           case when i.due < current_date then -1
                when i.due - current_date <= 0 then 0
                when i.due - current_date <= 14 then 14
                when i.due - current_date <= 30 then 30
                else 60 end as band
      from items i where i.due - current_date <= p_window
  )
  select r.id, r.email, r.full_name, r.language, b.practice_id, pr.name, b.kind, b.title, b.who, b.due, b.dl::int,
         b.base||':'||b.band
    from banded b
    join public.practices pr on pr.id = b.practice_id
    join public.profiles r on r.practice_id = b.practice_id and r.active
         and ( r.role in ('principal','practice_manager')
               or (r.role = 'staff' and b.owner = r.id and b.kind in ('evidence','training')) )
    left join public.alert_prefs ap on ap.profile_id = r.id
   where coalesce(ap.email_digest, true)
     and not exists (select 1 from public.alert_log l where l.profile_id = r.id and l.key = b.base||':'||b.band)
$$;

create or replace function public.alerts_mark_sent(p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.alert_log(profile_id, key)
  select (x->>'profile_id')::uuid, x->>'key' from jsonb_array_elements(p_rows) x
  on conflict do nothing;
  get diagnostics n = row_count; return n;
end $$;

revoke execute on function public.alerts_due(int) from public, anon, authenticated;
revoke execute on function public.alerts_mark_sent(jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.alerts_due(int) to service_role;
    grant execute on function public.alerts_mark_sent(jsonb) to service_role;
  end if;
end $$;
