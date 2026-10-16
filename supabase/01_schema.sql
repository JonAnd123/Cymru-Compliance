-- ==========================================================================
-- Cymru Compliance — Supabase schema, security rules and storage
-- Run ONCE in the Supabase SQL editor on a fresh project (London region).
-- Then run 02_seed.sql.
-- ==========================================================================


create type public.user_role as enum
  ('platform_admin','group_admin','principal','practice_manager','staff','inspector');

-- --------------------------------------------------------------------------
-- Core tables
-- --------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_mode text not null default 'consolidated' check (billing_mode in ('consolidated','per_practice')),
  created_at timestamptz not null default now()
);

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete set null,
  name text not null,
  address text,
  health_board text,
  hiw_registration text,
  package text not null default 'solo' check (package in ('solo','practice_plus','group')),
  next_inspection date,
  created_at timestamptz not null default now()
);
create index on public.practices(group_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null,
  practice_id uuid references public.practices(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  language text not null default 'en' check (language in ('en','cy')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.profiles(practice_id);
create index on public.profiles(group_id);
create unique index profiles_email_key on public.profiles (lower(email));

-- Access is invitation-only: nobody can create an account without an invite.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  role public.user_role not null,
  practice_id uuid references public.practices(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (role in ('principal','practice_manager','staff') and practice_id is not null)
    or (role = 'group_admin' and group_id is not null)
    or role in ('inspector','platform_admin')
  )
);
create unique index invites_open_email on public.invites (lower(email)) where not claimed;

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  category text not null check (category in
    ('registration','staff_training','decontamination','radiation','health_safety','policies')),
  title text not null,
  staff_member uuid references public.profiles(id) on delete set null,
  file_path text,
  file_name text,
  expiry_date date,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  uploaded_by uuid default auth.uid() references public.profiles(id) on delete set null,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.evidence(practice_id);

create table public.evidence_versions (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  version int not null,
  file_path text,
  file_name text,
  expiry_date date,
  uploaded_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.evidence_versions(evidence_id);

create table public.training_modules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('induction','refresher','pm')),
  title_en text not null,
  title_cy text,
  summary_en text,
  summary_cy text,
  points_en text[] default '{}',
  points_cy text[] default '{}',
  duration_mins int default 30,
  sort int default 0
);

create table public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  assigned_by uuid default auth.uid() references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed')),
  progress int not null default 0 check (progress between 0 and 100),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (module_id, profile_id)
);
create index on public.training_assignments(practice_id);

create table public.assessment_questions (
  id serial primary key,
  category text not null,
  ref text not null,
  text_en text not null,
  text_cy text,
  hint_en text,
  kind text not null default 'hiw',
  section text,
  sort int default 0
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  started_by uuid default auth.uid() references public.profiles(id) on delete set null,
  kind text not null default 'hiw',
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  score int,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.assessments(practice_id);

create table public.assessment_answers (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_id int not null references public.assessment_questions(id) on delete cascade,
  answer text not null check (answer in ('yes','partial','no','na')),
  note text,
  primary key (assessment_id, question_id)
);

create table public.compliance_snapshots (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  taken_on date not null default current_date,
  score int not null,
  cat_scores jsonb,
  unique (practice_id, taken_on)
);

create table public.inspector_grants (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  inspector_email text not null,
  granted_by uuid default auth.uid() references public.profiles(id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create index on public.inspector_grants(practice_id);
create index on public.inspector_grants(lower(inspector_email));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  kind text not null check (kind in ('pre_inspection','pm_training')),
  requested_by uuid default auth.uid() references public.profiles(id) on delete set null,
  preferred_date date,
  mode text not null default 'onsite' check (mode in ('onsite','remote')),
  seats int not null default 1 check (seats between 1 and 50),
  status text not null default 'requested' check (status in ('requested','confirmed','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.bookings(practice_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  actor_role text,
  practice_id uuid,
  group_id uuid,
  action text not null,
  entity text,
  entity_id text,
  detail jsonb
);
create index on public.audit_log(practice_id, at desc);
create index on public.audit_log(group_id, at desc);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'general' check (kind in ('demo','interest','general','waitlist')),
  practice_type text,
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  practice_name text check (char_length(practice_name) <= 200),
  sites int,
  role text check (char_length(role) <= 100),
  message text check (char_length(message) <= 4000),
  language text,
  status text not null default 'new' check (status in ('new','contacted','closed'))
);

-- --------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse)
-- --------------------------------------------------------------------------
create or replace function public.auth_role() returns public.user_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and active $$;

create or replace function public.auth_practice_id() returns uuid
language sql stable security definer set search_path = public as
$$ select practice_id from public.profiles where id = auth.uid() and active $$;

create or replace function public.auth_group_id() returns uuid
language sql stable security definer set search_path = public as
$$ select group_id from public.profiles where id = auth.uid() and active $$;

create or replace function public.auth_email() returns text
language sql stable security definer set search_path = public as
$$ select email from public.profiles where id = auth.uid() and active $$;

create or replace function public.is_group_admin_of(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.profiles p
     join public.practices pr on pr.group_id = p.group_id
     where p.id = auth.uid() and p.active and p.role = 'group_admin' and pr.id = pid) $$;

create or replace function public.has_inspector_grant(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.inspector_grants g
     join public.profiles p on p.id = auth.uid() and p.active and p.role = 'inspector'
                           and lower(p.email) = lower(g.inspector_email)
     where g.practice_id = pid and not g.revoked and now() between g.starts_at and g.expires_at) $$;

-- Read/write rights over one practice's own records (Principal, Practice Manager, platform admin)
create or replace function public.can_manage_practice(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.profiles p
     where p.id = auth.uid() and p.active
       and (p.role = 'platform_admin'
            or (p.role in ('principal','practice_manager') and p.practice_id = pid))) $$;

create or replace function public.can_read_practice(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.can_manage_practice(pid)
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.active
                   and p.role = 'staff' and p.practice_id = pid)
        or public.is_group_admin_of(pid)
        or public.has_inspector_grant(pid) $$;

create or replace function public.can_book(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.can_manage_practice(pid) or public.is_group_admin_of(pid) $$;

-- --------------------------------------------------------------------------
-- Invitation-only sign-up: create profile from invite, or reject the sign-up
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
declare inv public.invites%rowtype;
begin
  select * into inv from public.invites
   where lower(email) = lower(new.email) and not claimed limit 1;
  if not found then
    raise exception 'This email address has not been invited to Cymru Compliance';
  end if;
  insert into public.profiles (id, email, full_name, role, practice_id, group_id)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'full_name',''), inv.full_name),
          inv.role,
          case when inv.role in ('principal','practice_manager','staff') then inv.practice_id end,
          case when inv.role = 'group_admin' then inv.group_id end);
  update public.invites set claimed = true where id = inv.id;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- RPCs
-- --------------------------------------------------------------------------
create or replace function public.log_event(
  p_action text, p_entity text, p_entity_id text, p_practice uuid, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as
$$
declare pr public.profiles%rowtype; gid uuid;
begin
  select * into pr from public.profiles where id = auth.uid() and active;
  if not found then return; end if;
  if p_practice is not null then
    if not public.can_read_practice(p_practice) then return; end if;
    select group_id into gid from public.practices where id = p_practice;
  end if;
  insert into public.audit_log(actor, actor_email, actor_role, practice_id, group_id, action, entity, entity_id, detail)
  values (pr.id, pr.email, pr.role::text, p_practice, gid, p_action, p_entity, p_entity_id, p_detail);
end $$;

create or replace function public.update_my_profile(p_name text, p_lang text) returns void
language sql security definer set search_path = public as
$$ update public.profiles
      set full_name = coalesce(nullif(p_name,''), full_name),
          language = case when p_lang in ('en','cy') then p_lang else language end
    where id = auth.uid() and active $$;

create or replace function public.team_set_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as
$$
declare tgt public.profiles%rowtype;
begin
  select * into tgt from public.profiles where id = p_user;
  if not found then raise exception 'User not found'; end if;
  if tgt.id = auth.uid() then raise exception 'You cannot change your own access'; end if;
  if public.auth_role() = 'platform_admin'
     or (public.auth_role() in ('principal','practice_manager')
         and tgt.practice_id = public.auth_practice_id()
         and tgt.role in ('staff','practice_manager')
         and (public.auth_role() = 'principal' or tgt.role = 'staff')) then
    update public.profiles set active = p_active where id = p_user;
    perform public.log_event(case when p_active then 'user_reactivated' else 'user_deactivated' end,
                             'profile', p_user::text, tgt.practice_id, '{}'::jsonb);
  else
    raise exception 'Not permitted';
  end if;
end $$;

create or replace function public.admin_update_profile(
  p_user uuid, p_role public.user_role, p_practice uuid, p_group uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if public.auth_role() is distinct from 'platform_admin' then raise exception 'Not permitted'; end if;
  if p_user = auth.uid() and (p_active = false or p_role <> 'platform_admin') then
    raise exception 'You cannot remove your own admin access';
  end if;
  update public.profiles set role = p_role, practice_id = p_practice, group_id = p_group, active = p_active
   where id = p_user;
  perform public.log_event('admin_update_user','profile',p_user::text,p_practice,
          jsonb_build_object('role',p_role,'active',p_active));
end $$;

-- Average of the latest snapshot score across the practice's group (for "vs group average")
create or replace function public.group_average(pid uuid) returns numeric
language plpgsql stable security definer set search_path = public as
$$
declare gid uuid; res numeric;
begin
  if not public.can_read_practice(pid) then raise exception 'Not permitted'; end if;
  select group_id into gid from public.practices where id = pid;
  if gid is null then return null; end if;
  select avg(s.score) into res from public.practices pr
    join lateral (select score from public.compliance_snapshots c
                   where c.practice_id = pr.id order by taken_on desc limit 1) s on true
   where pr.group_id = gid;
  return res;
end $$;

-- Minimal, de-identified inputs used to compute the dashboard for every role
-- (so Staff, Group Admins and Inspectors never need row access to evidence).
create or replace function public.practice_inputs(p_practice uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare aid uuid; res jsonb; r public.user_role;
begin
  if not public.can_read_practice(p_practice) then raise exception 'Not permitted'; end if;
  r := public.auth_role();
  if r in ('group_admin','inspector','platform_admin') then
    perform public.log_event('view_dashboard','practice',p_practice::text,p_practice,'{}'::jsonb);
  end if;
  select id into aid from public.assessments
   where practice_id = p_practice and status = 'completed' and kind = 'hiw' order by completed_at desc limit 1;
  select jsonb_build_object(
    'practice', (select to_jsonb(p) from public.practices p where p.id = p_practice),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object(
                  'category',category,'status',status,'expiry_date',expiry_date))
                  from public.evidence where practice_id = p_practice), '[]'::jsonb),
    'assessment', case when aid is null then null else jsonb_build_object(
        'id', aid,
        'completed_at', (select completed_at from public.assessments where id = aid),
        'answers', coalesce((select jsonb_agg(jsonb_build_object('category',q.category,'answer',a.answer))
                    from public.assessment_answers a
                    join public.assessment_questions q on q.id = a.question_id
                    where a.assessment_id = aid), '[]'::jsonb)) end,
    'training', coalesce((select jsonb_agg(jsonb_build_object('kind',m.kind,'status',t.status))
                  from public.training_assignments t
                  join public.training_modules m on m.id = t.module_id
                  where t.practice_id = p_practice), '[]'::jsonb),
    'staff_count', (select count(*) from public.profiles
                     where practice_id = p_practice and active and role in ('staff','practice_manager','principal')),
    'pm_trained', exists (select 1 from public.training_assignments t
                  join public.training_modules m on m.id = t.module_id
                  where t.practice_id = p_practice and m.kind = 'pm' and t.status = 'completed'),
    'snapshots', coalesce((select jsonb_agg(jsonb_build_object('taken_on',taken_on,'score',score) order by taken_on)
                  from public.compliance_snapshots
                  where practice_id = p_practice and taken_on > current_date - 190), '[]'::jsonb)
  ) into res;
  return res;
end $$;

revoke execute on function public.log_event(text,text,text,uuid,jsonb) from public, anon;
revoke execute on function public.update_my_profile(text,text) from public, anon;
revoke execute on function public.team_set_active(uuid,boolean) from public, anon;
revoke execute on function public.admin_update_profile(uuid,public.user_role,uuid,uuid,boolean) from public, anon;
revoke execute on function public.group_average(uuid) from public, anon;
revoke execute on function public.practice_inputs(uuid) from public, anon;
grant execute on function public.log_event(text,text,text,uuid,jsonb) to authenticated;
grant execute on function public.update_my_profile(text,text) to authenticated;
grant execute on function public.team_set_active(uuid,boolean) to authenticated;
grant execute on function public.admin_update_profile(uuid,public.user_role,uuid,uuid,boolean) to authenticated;
grant execute on function public.group_average(uuid) to authenticated;
grant execute on function public.practice_inputs(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Guard triggers
-- --------------------------------------------------------------------------
create or replace function public.practices_guard() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return new; end if;  -- trusted backend / SQL editor
  if new.id <> old.id then raise exception 'Practice id cannot change'; end if;
  if new.group_id is distinct from old.group_id then
    if public.auth_role() = 'platform_admin' then
      null;
    elsif public.auth_role() = 'group_admin' and old.group_id = public.auth_group_id()
          and (new.group_id is null or new.group_id = public.auth_group_id()) then
      null;
    else
      raise exception 'Not permitted to change group membership';
    end if;
  end if;
  return new;
end $$;
create trigger practices_guard_trg before update on public.practices
  for each row execute function public.practices_guard();

create or replace function public.evidence_guard() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  new.updated_at := now();
  if auth.uid() is null then return new; end if;  -- trusted backend / SQL editor
  if new.practice_id <> old.practice_id then raise exception 'Cannot move evidence'; end if;
  if new.status is distinct from old.status then
    if not public.can_manage_practice(old.practice_id) then
      if new.status <> 'pending' then raise exception 'Only a Principal or Practice Manager can verify evidence'; end if;
    else
      if new.status in ('verified','rejected') then
        new.verified_by := auth.uid(); new.verified_at := now();
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger evidence_guard_trg before update on public.evidence
  for each row execute function public.evidence_guard();

-- --------------------------------------------------------------------------
-- Row-level security
-- --------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.practices enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.evidence enable row level security;
alter table public.evidence_versions enable row level security;
alter table public.training_modules enable row level security;
alter table public.training_assignments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.compliance_snapshots enable row level security;
alter table public.inspector_grants enable row level security;
alter table public.bookings enable row level security;
alter table public.audit_log enable row level security;
alter table public.enquiries enable row level security;

-- groups
create policy groups_select on public.groups for select to authenticated using (
  public.auth_role() = 'platform_admin'
  or id = public.auth_group_id()
  or id = (select group_id from public.practices where id = public.auth_practice_id()));
create policy groups_admin_write on public.groups for all to authenticated
  using (public.auth_role() = 'platform_admin') with check (public.auth_role() = 'platform_admin');
create policy groups_ga_update on public.groups for update to authenticated
  using (id = public.auth_group_id() and public.auth_role() = 'group_admin')
  with check (id = public.auth_group_id());

-- practices
-- The second clause checks the row itself (not via a table lookup) so that a Group Admin
-- can read back a practice they have just inserted (INSERT ... RETURNING).
create policy practices_select on public.practices for select to authenticated
  using (public.can_read_practice(id)
         or (group_id is not null and group_id = public.auth_group_id() and public.auth_role() = 'group_admin'));
create policy practices_insert on public.practices for insert to authenticated with check (
  public.auth_role() = 'platform_admin'
  or (public.auth_role() = 'group_admin' and group_id = public.auth_group_id()));
create policy practices_update on public.practices for update to authenticated using (
  public.auth_role() = 'platform_admin'
  or (public.auth_role() = 'principal' and id = public.auth_practice_id())
  or public.is_group_admin_of(id)) with check (true);
create policy practices_delete on public.practices for delete to authenticated
  using (public.auth_role() = 'platform_admin');

-- profiles (no direct writes; all changes go through RPCs above)
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.auth_role() = 'platform_admin'
  or (public.auth_role() in ('principal','practice_manager') and practice_id = public.auth_practice_id())
  or (public.auth_role() = 'group_admin' and (group_id = public.auth_group_id()
        or (practice_id is not null and public.is_group_admin_of(practice_id)))));

-- invites
create policy invites_select on public.invites for select to authenticated using (
  public.auth_role() = 'platform_admin'
  or (public.auth_role() in ('principal','practice_manager') and practice_id = public.auth_practice_id())
  or (public.auth_role() = 'group_admin' and (group_id = public.auth_group_id()
        or (practice_id is not null and public.is_group_admin_of(practice_id)))));
create policy invites_insert on public.invites for insert to authenticated with check (
  public.auth_role() = 'platform_admin'
  or (public.auth_role() = 'principal' and practice_id = public.auth_practice_id()
      and role in ('staff','practice_manager','inspector'))
  or (public.auth_role() = 'practice_manager' and practice_id = public.auth_practice_id()
      and role = 'staff')
  or (public.auth_role() = 'group_admin' and role = 'principal'
      and practice_id is not null and public.is_group_admin_of(practice_id)));
create policy invites_delete on public.invites for delete to authenticated using (
  not claimed and (
    public.auth_role() = 'platform_admin'
    or (public.auth_role() in ('principal','practice_manager') and practice_id = public.auth_practice_id())
    or (public.auth_role() = 'group_admin' and practice_id is not null and public.is_group_admin_of(practice_id))));

-- evidence
create policy evidence_select on public.evidence for select to authenticated using (
  public.can_manage_practice(practice_id)
  or public.has_inspector_grant(practice_id)
  or (public.can_read_practice(practice_id) and (uploaded_by = auth.uid() or staff_member = auth.uid())));
create policy evidence_insert on public.evidence for insert to authenticated with check (
  public.can_manage_practice(practice_id)
  or (public.auth_role() = 'staff' and practice_id = public.auth_practice_id()
      and uploaded_by = auth.uid() and (staff_member is null or staff_member = auth.uid())
      and status = 'pending'));
create policy evidence_update on public.evidence for update to authenticated using (
  public.can_manage_practice(practice_id)
  or (public.auth_role() = 'staff' and uploaded_by = auth.uid() and status <> 'verified'))
  with check (
  public.can_manage_practice(practice_id)
  or (public.auth_role() = 'staff' and uploaded_by = auth.uid()));

create policy evver_select on public.evidence_versions for select to authenticated
  using (exists (select 1 from public.evidence e where e.id = evidence_id));
create policy evver_insert on public.evidence_versions for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (select 1 from public.evidence e where e.id = evidence_id));

-- training
create policy modules_select on public.training_modules for select to authenticated using (true);
create policy modules_admin on public.training_modules for all to authenticated
  using (public.auth_role() = 'platform_admin') with check (public.auth_role() = 'platform_admin');
create policy assign_select on public.training_assignments for select to authenticated using (
  (profile_id = auth.uid() and public.auth_role() is not null)
  or public.can_manage_practice(practice_id) or public.is_group_admin_of(practice_id));
create policy assign_insert on public.training_assignments for insert to authenticated
  with check (public.can_book(practice_id));
create policy assign_update on public.training_assignments for update to authenticated
  using ((profile_id = auth.uid() and public.auth_role() is not null) or public.can_manage_practice(practice_id))
  with check ((profile_id = auth.uid() and public.auth_role() is not null) or public.can_manage_practice(practice_id));

-- self-assessment
create policy aq_select on public.assessment_questions for select to authenticated using (true);
create policy aq_admin on public.assessment_questions for all to authenticated
  using (public.auth_role() = 'platform_admin') with check (public.auth_role() = 'platform_admin');
create policy assess_select on public.assessments for select to authenticated
  using (public.can_manage_practice(practice_id) or public.has_inspector_grant(practice_id));
create policy assess_insert on public.assessments for insert to authenticated
  with check (public.can_manage_practice(practice_id));
create policy assess_update on public.assessments for update to authenticated
  using (public.can_manage_practice(practice_id)) with check (public.can_manage_practice(practice_id));
create policy ans_select on public.assessment_answers for select to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id));
create policy ans_write on public.assessment_answers for all to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id and public.can_manage_practice(a.practice_id)))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and public.can_manage_practice(a.practice_id)));

-- snapshots
create policy snap_select on public.compliance_snapshots for select to authenticated
  using (public.can_read_practice(practice_id));
create policy snap_insert on public.compliance_snapshots for insert to authenticated
  with check (public.can_book(practice_id));
create policy snap_update on public.compliance_snapshots for update to authenticated
  using (public.can_book(practice_id)) with check (public.can_book(practice_id));

-- inspector grants
create policy grants_select on public.inspector_grants for select to authenticated using (
  public.can_manage_practice(practice_id)
  or lower(inspector_email) = lower(public.auth_email()));
create policy grants_insert on public.inspector_grants for insert to authenticated
  with check (public.auth_role() in ('principal','platform_admin') and public.can_manage_practice(practice_id));
create policy grants_update on public.inspector_grants for update to authenticated
  using (public.auth_role() in ('principal','platform_admin') and public.can_manage_practice(practice_id))
  with check (public.auth_role() in ('principal','platform_admin') and public.can_manage_practice(practice_id));

-- bookings
create policy bookings_select on public.bookings for select to authenticated
  using (public.can_manage_practice(practice_id) or public.is_group_admin_of(practice_id));
create policy bookings_insert on public.bookings for insert to authenticated
  with check (public.can_book(practice_id) and requested_by = auth.uid() and status = 'requested');
create policy bookings_update on public.bookings for update to authenticated
  using (public.can_manage_practice(practice_id) or public.is_group_admin_of(practice_id))
  with check (public.auth_role() = 'platform_admin' or status = 'cancelled');

-- audit log (insert only via log_event; never updated or deleted)
create policy audit_select on public.audit_log for select to authenticated using (
  public.auth_role() = 'platform_admin'
  or (public.auth_role() in ('principal','practice_manager') and practice_id = public.auth_practice_id())
  or (public.auth_role() = 'group_admin' and group_id = public.auth_group_id()));

-- enquiries: the public website may insert; only platform admin may read/update
create policy enq_insert on public.enquiries for insert to anon, authenticated with check (true);
create policy enq_select on public.enquiries for select to authenticated using (public.auth_role() = 'platform_admin');
create policy enq_update on public.enquiries for update to authenticated
  using (public.auth_role() = 'platform_admin') with check (public.auth_role() = 'platform_admin');

-- --------------------------------------------------------------------------
-- Storage: private bucket for certificates, evidence and gap reports
-- Object path convention:  <practice_id>/<random>-<filename>
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence','evidence', false, 10485760,
        array['application/pdf','image/png','image/jpeg',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy evidence_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'evidence' and (
    public.can_manage_practice(((storage.foldername(name))[1])::uuid)
    or public.has_inspector_grant(((storage.foldername(name))[1])::uuid)
    or (owner = auth.uid() and public.auth_role() is not null)));
create policy evidence_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'evidence' and (
    public.can_manage_practice(((storage.foldername(name))[1])::uuid)
    or (public.auth_role() = 'staff' and public.auth_practice_id() = ((storage.foldername(name))[1])::uuid)));

-- --------------------------------------------------------------------------
-- Bootstrap: invite yourself as the platform admin. Change the email, run,
-- then create your account on the portal sign-in screen with that email.
-- --------------------------------------------------------------------------
insert into public.invites (email, full_name, role)
values ('jonathan.milton.anderson@gmail.com', 'Jon Anderson', 'platform_admin');
