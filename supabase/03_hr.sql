-- ==========================================================================
-- Cymru Compliance — HR module (staff records, leave, documents, notes)
-- Run AFTER 01_schema.sql (and 02_seed.sql). Safe to run on an existing project.
--
-- Who can do what
--   Principal / Practice Manager (own practice) and platform admin: full read/write
--   Group Admin: READ-ONLY, full detail, for practices in their group (every view should be audited)
--   Staff: read their own record and leave; request leave; cancel their own pending requests
--   Inspector: no access
-- Staff are matched to their login by email address (hr_staff.email = profiles.email).
-- ==========================================================================

create table if not exists public.hr_staff (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  full_name text not null,
  job_title text,
  email text,
  phone text,
  address text,
  start_date date,
  end_date date,
  employment_type text not null default 'permanent'
    check (employment_type in ('permanent','fixed_term','part_time','locum','zero_hours')),
  contracted_hours numeric(4,1),
  annual_leave_days numeric(4,1) not null default 28,
  leave_year_start_month int not null default 1 check (leave_year_start_month between 1 and 12),
  emergency_name text,
  emergency_relation text,
  emergency_phone text,
  gdc_number text,
  gdc_expiry date,
  indemnity_expiry date,
  dbs_expiry date,
  photo_path text,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_staff_practice_idx on public.hr_staff(practice_id);
create index if not exists hr_staff_email_idx on public.hr_staff(lower(email));

create table if not exists public.hr_leave (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  staff_id uuid not null references public.hr_staff(id) on delete cascade,
  leave_type text not null check (leave_type in
    ('annual','sick','maternity','paternity','adoption','shared_parental','compassionate','study','unpaid','other')),
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  days numeric(5,1) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
  reason text,
  manager_note text,
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists hr_leave_practice_idx on public.hr_leave(practice_id, start_date);
create index if not exists hr_leave_staff_idx on public.hr_leave(staff_id);

create table if not exists public.hr_documents (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  staff_id uuid not null references public.hr_staff(id) on delete cascade,
  kind text not null default 'other' check (kind in
    ('contract','right_to_work','appraisal','disciplinary','dbs','qualification','other')),
  title text not null,
  file_path text not null,
  file_name text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists hr_documents_staff_idx on public.hr_documents(staff_id);

create table if not exists public.hr_notes (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  staff_id uuid not null references public.hr_staff(id) on delete cascade,
  kind text not null default 'general' check (kind in ('appraisal','one_to_one','return_to_work','general')),
  note_date date not null default current_date,
  body text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists hr_notes_staff_idx on public.hr_notes(staff_id);

-- --------------------------------------------------------------------------
-- Helpers
-- --------------------------------------------------------------------------
-- The HR record that belongs to the signed-in user (matched by email within their practice)
create or replace function public.my_hr_staff_id() returns uuid
language sql stable security definer set search_path = public as
$$ select h.id from public.hr_staff h
   join public.profiles p on p.id = auth.uid() and p.active
        and p.role in ('staff','practice_manager','principal')
        and p.practice_id = h.practice_id and lower(p.email) = lower(h.email)
   where h.active
   limit 1 $$;

-- --------------------------------------------------------------------------
-- Guard triggers
-- --------------------------------------------------------------------------
create or replace function public.hr_touch() returns trigger language plpgsql as
$$ begin new.updated_at := now(); if tg_op = 'INSERT' and auth.uid() is not null then new.created_by := auth.uid(); end if; return new; end $$;
drop trigger if exists hr_staff_touch on public.hr_staff;
create trigger hr_staff_touch before insert or update on public.hr_staff
  for each row execute function public.hr_touch();

-- child rows must belong to the same practice as their staff member
create or replace function public.hr_same_practice() returns trigger language plpgsql as
$$ begin
  if not exists (select 1 from public.hr_staff s where s.id = new.staff_id and s.practice_id = new.practice_id) then
    raise exception 'Staff member does not belong to this practice';
  end if;
  if tg_op = 'INSERT' and tg_table_name in ('hr_documents','hr_notes') and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists hr_leave_same on public.hr_leave;
create trigger hr_leave_same before insert or update on public.hr_leave for each row execute function public.hr_same_practice();
drop trigger if exists hr_docs_same on public.hr_documents;
create trigger hr_docs_same before insert or update on public.hr_documents for each row execute function public.hr_same_practice();
drop trigger if exists hr_notes_same on public.hr_notes;
create trigger hr_notes_same before insert or update on public.hr_notes for each row execute function public.hr_same_practice();

create or replace function public.hr_leave_guard() returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return new; end if;               -- SQL editor / service role
  if tg_op = 'INSERT' then
    new.requested_by := auth.uid();
    if public.can_manage_practice(new.practice_id) then
      if new.status in ('approved','declined') then new.decided_by := auth.uid(); new.decided_at := now(); end if;
    else
      -- employees may only submit their own pending requests
      if new.staff_id is distinct from public.my_hr_staff_id() or new.status <> 'pending' then
        raise exception 'Staff can only submit their own pending leave requests';
      end if;
      new.decided_by := null; new.decided_at := null; new.manager_note := null;
    end if;
    return new;
  end if;
  -- UPDATE
  if new.practice_id <> old.practice_id or new.staff_id <> old.staff_id then
    raise exception 'Leave cannot be moved to another person or practice';
  end if;
  if public.can_manage_practice(old.practice_id) then
    if new.status is distinct from old.status and new.status in ('approved','declined') then
      new.decided_by := auth.uid(); new.decided_at := now();
    end if;
    return new;
  end if;
  -- employee cancelling their own pending request: nothing else may change
  if old.staff_id is distinct from public.my_hr_staff_id() or old.status <> 'pending' or new.status <> 'cancelled'
     or new.leave_type <> old.leave_type or new.start_date <> old.start_date or new.end_date <> old.end_date
     or new.days <> old.days or new.half_day <> old.half_day
     or new.manager_note is distinct from old.manager_note or new.decided_by is distinct from old.decided_by then
    raise exception 'Staff can only cancel their own pending requests';
  end if;
  return new;
end $$;
drop trigger if exists hr_leave_guard_trg on public.hr_leave;
create trigger hr_leave_guard_trg before insert or update on public.hr_leave
  for each row execute function public.hr_leave_guard();

-- --------------------------------------------------------------------------
-- Who is off (no leave type shown, so colleagues never see sick/maternity details)
-- --------------------------------------------------------------------------
create or replace function public.hr_whos_off(p_practice uuid, p_from date, p_to date)
returns table (staff_id uuid, full_name text, start_date date, end_date date, half_day boolean)
language plpgsql stable security definer set search_path = public as
$$
begin
  if not ( public.can_manage_practice(p_practice) or public.is_group_admin_of(p_practice)
           or exists (select 1 from public.profiles p where p.id = auth.uid() and p.active
                      and p.role = 'staff' and p.practice_id = p_practice) ) then
    raise exception 'Not permitted';
  end if;
  return query
    select l.staff_id, s.full_name, l.start_date, l.end_date, l.half_day
    from public.hr_leave l join public.hr_staff s on s.id = l.staff_id
    where l.practice_id = p_practice and l.status = 'approved'
      and l.start_date <= p_to and l.end_date >= p_from
    order by l.start_date;
end $$;

-- --------------------------------------------------------------------------
-- Row-level security
-- --------------------------------------------------------------------------
alter table public.hr_staff enable row level security;
alter table public.hr_leave enable row level security;
alter table public.hr_documents enable row level security;
alter table public.hr_notes enable row level security;

drop policy if exists hr_staff_select on public.hr_staff;
create policy hr_staff_select on public.hr_staff for select to authenticated using (
  public.can_manage_practice(practice_id) or public.is_group_admin_of(practice_id) or id = public.my_hr_staff_id());
drop policy if exists hr_staff_insert on public.hr_staff;
create policy hr_staff_insert on public.hr_staff for insert to authenticated with check (public.can_manage_practice(practice_id));
drop policy if exists hr_staff_update on public.hr_staff;
create policy hr_staff_update on public.hr_staff for update to authenticated
  using (public.can_manage_practice(practice_id)) with check (public.can_manage_practice(practice_id));
drop policy if exists hr_staff_delete on public.hr_staff;
create policy hr_staff_delete on public.hr_staff for delete to authenticated using (public.auth_role() = 'platform_admin');

drop policy if exists hr_leave_select on public.hr_leave;
create policy hr_leave_select on public.hr_leave for select to authenticated using (
  public.can_manage_practice(practice_id) or public.is_group_admin_of(practice_id) or staff_id = public.my_hr_staff_id());
drop policy if exists hr_leave_insert on public.hr_leave;
create policy hr_leave_insert on public.hr_leave for insert to authenticated with check (
  public.can_manage_practice(practice_id) or (staff_id = public.my_hr_staff_id() and status = 'pending'));
drop policy if exists hr_leave_update on public.hr_leave;
create policy hr_leave_update on public.hr_leave for update to authenticated
  using (public.can_manage_practice(practice_id) or (staff_id = public.my_hr_staff_id() and status = 'pending'))
  with check (public.can_manage_practice(practice_id) or staff_id = public.my_hr_staff_id());

drop policy if exists hr_docs_select on public.hr_documents;
create policy hr_docs_select on public.hr_documents for select to authenticated using (
  public.can_manage_practice(practice_id) or public.is_group_admin_of(practice_id));
drop policy if exists hr_docs_insert on public.hr_documents;
create policy hr_docs_insert on public.hr_documents for insert to authenticated with check (public.can_manage_practice(practice_id));
drop policy if exists hr_docs_delete on public.hr_documents;
create policy hr_docs_delete on public.hr_documents for delete to authenticated using (public.can_manage_practice(practice_id));

drop policy if exists hr_notes_select on public.hr_notes;
create policy hr_notes_select on public.hr_notes for select to authenticated using (
  public.can_manage_practice(practice_id) or public.is_group_admin_of(practice_id));
drop policy if exists hr_notes_insert on public.hr_notes;
create policy hr_notes_insert on public.hr_notes for insert to authenticated with check (public.can_manage_practice(practice_id));

-- --------------------------------------------------------------------------
-- Storage: private bucket "hr" for staff photos and documents
-- Object path convention:  <practice_id>/<staff_id>/<random>-<filename>
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr','hr', false, 10485760,
        array['application/pdf','image/png','image/jpeg','image/webp',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

drop policy if exists hr_obj_select on storage.objects;
create policy hr_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'hr' and (
    public.can_manage_practice(((storage.foldername(name))[1])::uuid)
    or public.is_group_admin_of(((storage.foldername(name))[1])::uuid)
    or ((storage.foldername(name))[2])::uuid = public.my_hr_staff_id()));
drop policy if exists hr_obj_insert on storage.objects;
create policy hr_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'hr' and public.can_manage_practice(((storage.foldername(name))[1])::uuid));
drop policy if exists hr_obj_delete on storage.objects;
create policy hr_obj_delete on storage.objects for delete to authenticated using (
  bucket_id = 'hr' and public.can_manage_practice(((storage.foldername(name))[1])::uuid));
