create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'employee'
    check (role in ('hr', 'supervisor', 'employee')),
  first_name text not null default '',
  middle_name text,
  last_name text not null default '',
  phone text,
  employee_number text,
  email_notice_status text,
  sms_notice_status text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists middle_name text,
  add column if not exists last_name text not null default '',
  add column if not exists phone text,
  add column if not exists employee_number text,
  add column if not exists email_notice_status text,
  add column if not exists sms_notice_status text,
  add column if not exists is_active boolean not null default true;

alter table public.profiles drop constraint if exists profiles_email_notice_status_check;
alter table public.profiles
  add constraint profiles_email_notice_status_check
  check (
    email_notice_status is null
    or email_notice_status in ('sent', 'failed', 'not_configured')
  );

alter table public.profiles drop constraint if exists profiles_sms_notice_status_check;
alter table public.profiles
  add constraint profiles_sms_notice_status_check
  check (
    sms_notice_status is null
    or sms_notice_status in ('sent', 'failed', 'not_configured')
  );

create unique index if not exists profiles_employee_number_unique
  on public.profiles (employee_number)
  where employee_number is not null;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.duty_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.duty_shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.personnel_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.profiles (id) on delete cascade,
  supervisor_id uuid not null references public.profiles (id) on delete restrict,
  post_id uuid not null references public.posts (id) on delete restrict,
  duty_location_id uuid not null references public.duty_locations (id) on delete restrict,
  duty_shift_id uuid not null references public.duty_shifts (id) on delete restrict,
  start_date date not null,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active
  );
$$;

create or replace function public.current_user_has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = required_role
      and is_active
  );
$$;

revoke all on function public.current_user_is_active() from public;
revoke all on function public.current_user_has_role(text) from public;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_has_role(text) to authenticated;

create or replace function public.validate_personnel_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.employee_id and role = 'employee' and is_active
  ) then
    raise exception 'Assignment employee must be an active employee account.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = new.supervisor_id and role = 'supervisor' and is_active
  ) then
    raise exception 'Assignment supervisor must be an active supervisor account.';
  end if;

  if not exists (select 1 from public.posts where id = new.post_id and is_active)
    or not exists (
      select 1 from public.duty_locations
      where id = new.duty_location_id and is_active
    )
    or not exists (
      select 1 from public.duty_shifts
      where id = new.duty_shift_id and is_active
    ) then
    raise exception 'Assignment options must be active.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_personnel_assignment on public.personnel_assignments;
create trigger validate_personnel_assignment
  before insert or update on public.personnel_assignments
  for each row execute function public.validate_personnel_assignment();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.duty_locations enable row level security;
alter table public.duty_shifts enable row level security;
alter table public.personnel_assignments enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "HR and assigned supervisors can read profiles" on public.profiles;
drop policy if exists "HR can update profiles" on public.profiles;
create policy "HR and assigned supervisors can read profiles"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or (select public.current_user_has_role('hr'))
    or (
      (select public.current_user_has_role('supervisor'))
      and exists (
        select 1
        from public.personnel_assignments
        where personnel_assignments.employee_id = profiles.id
          and personnel_assignments.supervisor_id = (select auth.uid())
      )
    )
  );
create policy "HR can update profiles"
  on public.profiles
  for update
  to authenticated
  using ((select public.current_user_has_role('hr')))
  with check ((select public.current_user_has_role('hr')));

drop policy if exists "Active users can read posts" on public.posts;
drop policy if exists "HR can manage posts" on public.posts;
create policy "Active users can read posts"
  on public.posts
  for select
  to authenticated
  using ((select public.current_user_is_active()));
create policy "HR can manage posts"
  on public.posts
  for all
  to authenticated
  using ((select public.current_user_has_role('hr')))
  with check ((select public.current_user_has_role('hr')));

drop policy if exists "Active users can read duty locations" on public.duty_locations;
drop policy if exists "HR can manage duty locations" on public.duty_locations;
create policy "Active users can read duty locations"
  on public.duty_locations
  for select
  to authenticated
  using ((select public.current_user_is_active()));
create policy "HR can manage duty locations"
  on public.duty_locations
  for all
  to authenticated
  using ((select public.current_user_has_role('hr')))
  with check ((select public.current_user_has_role('hr')));

drop policy if exists "Active users can read duty shifts" on public.duty_shifts;
drop policy if exists "HR can manage duty shifts" on public.duty_shifts;
create policy "Active users can read duty shifts"
  on public.duty_shifts
  for select
  to authenticated
  using ((select public.current_user_is_active()));
create policy "HR can manage duty shifts"
  on public.duty_shifts
  for all
  to authenticated
  using ((select public.current_user_has_role('hr')))
  with check ((select public.current_user_has_role('hr')));

drop policy if exists "Users can read related assignments" on public.personnel_assignments;
drop policy if exists "HR can manage assignments" on public.personnel_assignments;
create policy "Users can read related assignments"
  on public.personnel_assignments
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      employee_id = (select auth.uid())
      or supervisor_id = (select auth.uid())
      or (select public.current_user_has_role('hr'))
    )
  );
create policy "HR can manage assignments"
  on public.personnel_assignments
  for all
  to authenticated
  using ((select public.current_user_has_role('hr')))
  with check ((select public.current_user_has_role('hr')));

grant select on public.profiles to authenticated;
revoke update (employee_number, email_notice_status, sms_notice_status)
  on public.profiles from authenticated;
grant update (first_name, middle_name, last_name, phone, is_active)
  on public.profiles to authenticated;
grant select, insert, update, delete
  on public.posts, public.duty_locations, public.duty_shifts, public.personnel_assignments
  to authenticated;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

-- Keep profile email aligned when Auth applies an email change, including
-- after a confirmation flow. Does not change role, status, or assignments.
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = coalesce(new.email, '')
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email_from_auth();

-- Phase 4 attendance. No retention period is defined, so evidence is kept
-- until an approved retention policy exists. No default geofence radius is set.
alter table public.duty_locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geofence_radius_meters integer;

alter table public.duty_locations
  drop constraint if exists duty_locations_geofence_complete;
alter table public.duty_locations
  add constraint duty_locations_geofence_complete check (
    (
      latitude is null
      and longitude is null
      and geofence_radius_meters is null
    )
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
      and geofence_radius_meters > 0
    )
  );

create table if not exists public.attendance_records (
  id uuid primary key,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  assignment_id uuid not null references public.personnel_assignments (id) on delete restrict,
  post_id uuid not null references public.posts (id) on delete restrict,
  duty_location_id uuid not null references public.duty_locations (id) on delete restrict,
  duty_shift_id uuid not null references public.duty_shifts (id) on delete restrict,
  attendance_date date not null,
  time_in_at timestamptz not null,
  time_out_at timestamptz,
  time_in_captured_at timestamptz,
  time_out_captured_at timestamptz,
  time_in_latitude double precision not null,
  time_in_longitude double precision not null,
  time_in_accuracy_m double precision not null,
  time_out_latitude double precision,
  time_out_longitude double precision,
  time_out_accuracy_m double precision,
  time_in_location_label text,
  time_out_location_label text,
  time_in_photo_path text not null,
  time_out_photo_path text,
  time_in_verification text not null,
  time_out_verification text,
  shift_note text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_status_check check (status in ('open', 'completed')),
  constraint attendance_time_in_verification_check check (
    time_in_verification in ('inside_geofence', 'gps_captured_no_geofence')
  ),
  constraint attendance_time_out_verification_check check (
    time_out_verification is null
    or time_out_verification in ('inside_geofence', 'gps_captured_no_geofence')
  ),
  constraint attendance_shift_note_check check (
    shift_note is null
    or shift_note in ('early', 'on_time', 'late', 'outside_window')
  ),
  constraint attendance_open_shape check (
    (
      status = 'open'
      and time_out_at is null
      and time_out_photo_path is null
      and time_out_verification is null
    )
    or (
      status = 'completed'
      and time_out_at is not null
      and time_out_photo_path is not null
      and time_out_verification is not null
      and time_out_at > time_in_at
    )
  )
);

create unique index if not exists attendance_one_open_session
  on public.attendance_records (employee_id)
  where time_out_at is null;

create unique index if not exists attendance_one_per_manila_date
  on public.attendance_records (employee_id, attendance_date);

create index if not exists attendance_records_date_idx
  on public.attendance_records (attendance_date desc, time_in_at desc);

create or replace function public.protect_attendance_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assignment_start date;
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.profiles
      where id = new.employee_id
        and role = 'employee'
        and is_active
    ) then
      raise exception 'Attendance employee must be an active employee.';
    end if;

    select start_date
    into assignment_start
    from public.personnel_assignments
    where id = new.assignment_id
      and employee_id = new.employee_id;

    if assignment_start is null then
      raise exception 'Attendance assignment does not belong to this employee.';
    end if;

    new.time_in_at := clock_timestamp();
    new.attendance_date := (new.time_in_at at time zone 'Asia/Manila')::date;
    new.time_out_at := null;
    new.time_out_captured_at := null;
    new.time_out_latitude := null;
    new.time_out_longitude := null;
    new.time_out_accuracy_m := null;
    new.time_out_location_label := null;
    new.time_out_photo_path := null;
    new.time_out_verification := null;
    new.status := 'open';
    new.created_at := new.time_in_at;
    new.updated_at := new.time_in_at;

    if new.attendance_date < assignment_start then
      raise exception 'Attendance cannot be recorded before the assignment start date.';
    end if;
    if new.time_in_photo_path is distinct from
      new.employee_id::text || '/' || new.id::text || '/time-in.jpg' then
      raise exception 'Invalid Time In evidence path.';
    end if;
    if new.time_in_verification not in ('inside_geofence', 'gps_captured_no_geofence') then
      raise exception 'Invalid Time In verification.';
    end if;
    return new;
  end if;

  if old.status = 'completed' or old.time_out_at is not null then
    raise exception 'Completed attendance cannot be modified.';
  end if;

  new.id := old.id;
  new.employee_id := old.employee_id;
  new.assignment_id := old.assignment_id;
  new.post_id := old.post_id;
  new.duty_location_id := old.duty_location_id;
  new.duty_shift_id := old.duty_shift_id;
  new.attendance_date := old.attendance_date;
  new.time_in_at := old.time_in_at;
  new.time_in_captured_at := old.time_in_captured_at;
  new.time_in_latitude := old.time_in_latitude;
  new.time_in_longitude := old.time_in_longitude;
  new.time_in_accuracy_m := old.time_in_accuracy_m;
  new.time_in_location_label := old.time_in_location_label;
  new.time_in_photo_path := old.time_in_photo_path;
  new.time_in_verification := old.time_in_verification;
  new.shift_note := old.shift_note;
  new.created_at := old.created_at;

  if new.time_out_photo_path is distinct from
    old.employee_id::text || '/' || old.id::text || '/time-out.jpg' then
    raise exception 'Invalid Time Out evidence path.';
  end if;
  if new.time_out_verification not in ('inside_geofence', 'gps_captured_no_geofence') then
    raise exception 'Invalid Time Out verification.';
  end if;

  new.time_out_at := clock_timestamp();
  if new.time_out_at <= old.time_in_at then
    raise exception 'Time Out must be after Time In.';
  end if;
  new.status := 'completed';
  new.updated_at := new.time_out_at;
  return new;
end;
$$;

drop trigger if exists protect_attendance_record on public.attendance_records;
create trigger protect_attendance_record
  before insert or update on public.attendance_records
  for each row execute function public.protect_attendance_record();

alter table public.attendance_records enable row level security;

drop policy if exists "Authorized users can read attendance" on public.attendance_records;
create policy "Authorized users can read attendance"
  on public.attendance_records
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      employee_id = (select auth.uid())
      or (select public.current_user_has_role('hr'))
      or (
        (select public.current_user_has_role('supervisor'))
        and exists (
          select 1
          from public.personnel_assignments
          where personnel_assignments.employee_id = attendance_records.employee_id
            and personnel_assignments.supervisor_id = (select auth.uid())
        )
      )
    )
  );

revoke all on public.attendance_records from anon, authenticated;
grant select on public.attendance_records to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('attendance-evidence', 'attendance-evidence', false)
    on conflict (id) do update set public = false;
  end if;

  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Employees read own attendance evidence" on storage.objects';
    execute 'drop policy if exists "HR reads attendance evidence" on storage.objects';
    execute 'drop policy if exists "Supervisors read assigned attendance evidence" on storage.objects';
    execute $policy$
      create policy "Employees read own attendance evidence"
        on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'attendance-evidence'
          and (storage.foldername(name))[1] = (select auth.uid())::text
          and (select public.current_user_is_active())
        )
    $policy$;
    execute $policy$
      create policy "HR reads attendance evidence"
        on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'attendance-evidence'
          and (select public.current_user_has_role('hr'))
        )
    $policy$;
    execute $policy$
      create policy "Supervisors read assigned attendance evidence"
        on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'attendance-evidence'
          and (select public.current_user_has_role('supervisor'))
          and exists (
            select 1
            from public.personnel_assignments
            where personnel_assignments.employee_id::text = (storage.foldername(name))[1]
              and personnel_assignments.supervisor_id = (select auth.uid())
          )
        )
    $policy$;
  end if;
end;
$$;

-- Duty configurations link an existing post, location, and shift for HR
-- management. They do not replace personnel_assignments and do not store GPS.
create table if not exists public.duty_configurations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete restrict,
  duty_location_id uuid not null references public.duty_locations (id) on delete restrict,
  duty_shift_id uuid not null references public.duty_shifts (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint duty_configurations_bundle_unique unique (post_id, duty_location_id, duty_shift_id)
);

insert into public.duty_configurations (post_id, duty_location_id, duty_shift_id)
select distinct post_id, duty_location_id, duty_shift_id
from public.personnel_assignments
on conflict (post_id, duty_location_id, duty_shift_id) do nothing;

alter table public.duty_configurations enable row level security;

drop policy if exists "HR can read duty configurations" on public.duty_configurations;
create policy "HR can read duty configurations"
  on public.duty_configurations
  for select
  to authenticated
  using ((select public.current_user_has_role('hr')));

revoke all on public.duty_configurations from anon, authenticated;
grant select on public.duty_configurations to authenticated;

create or replace function public.save_duty_configuration(
  configuration_id uuid,
  post_id uuid,
  post_name text,
  post_description text,
  location_id uuid,
  location_name text,
  location_address text,
  shift_id uuid,
  shift_name text,
  shift_start text,
  shift_end text,
  is_active boolean,
  acknowledge_shared boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_configuration uuid;
  resolved_post uuid;
  resolved_location uuid;
  resolved_shift uuid;
  start_time time;
  end_time time;
  post_shared boolean := false;
  location_shared boolean := false;
  shift_shared boolean := false;
  assignment_count integer := 0;
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR users can manage duty configurations.';
  end if;

  post_name := btrim(coalesce(post_name, ''));
  location_name := btrim(coalesce(location_name, ''));
  shift_name := btrim(coalesce(shift_name, ''));
  post_description := nullif(btrim(coalesce(post_description, '')), '');
  location_address := nullif(btrim(coalesce(location_address, '')), '');

  if post_name = '' then
    raise exception 'Enter a post name.';
  end if;
  if location_name = '' then
    raise exception 'Enter a duty location name.';
  end if;
  if shift_name = '' then
    raise exception 'Enter a shift name.';
  end if;

  begin
    start_time := shift_start::time;
    end_time := shift_end::time;
  exception
    when others then
      raise exception 'Enter a valid start time and end time.';
  end;

  if start_time = end_time then
    raise exception 'End time must differ from start time. Use an earlier end time for an overnight shift.';
  end if;

  if configuration_id is not null and not exists (
    select 1
    from public.duty_configurations
    where id = configuration_id
      and post_id = post_id
      and duty_location_id = location_id
      and duty_shift_id = shift_id
  ) then
    raise exception 'The selected duty configuration does not match these records.';
  end if;

  if post_id is not null and not exists (select 1 from public.posts where id = post_id) then
    raise exception 'The selected post no longer exists.';
  end if;
  if location_id is not null and not exists (
    select 1 from public.duty_locations where id = location_id
  ) then
    raise exception 'The selected duty location no longer exists.';
  end if;
  if shift_id is not null and not exists (
    select 1 from public.duty_shifts where id = shift_id
  ) then
    raise exception 'The selected duty shift no longer exists.';
  end if;

  if post_id is not null then
    post_shared := exists (
      select 1
      from public.personnel_assignments
      where personnel_assignments.post_id = save_duty_configuration.post_id
        and (
          personnel_assignments.duty_location_id is distinct from location_id
          or personnel_assignments.duty_shift_id is distinct from shift_id
        )
    ) or exists (
      select 1
      from public.duty_configurations
      where duty_configurations.post_id = save_duty_configuration.post_id
        and (configuration_id is null or duty_configurations.id is distinct from configuration_id)
        and (
          duty_configurations.duty_location_id is distinct from location_id
          or duty_configurations.duty_shift_id is distinct from shift_id
        )
    );
  end if;

  if location_id is not null then
    location_shared := exists (
      select 1
      from public.personnel_assignments
      where personnel_assignments.duty_location_id = save_duty_configuration.location_id
        and (
          personnel_assignments.post_id is distinct from post_id
          or personnel_assignments.duty_shift_id is distinct from shift_id
        )
    ) or exists (
      select 1
      from public.duty_configurations
      where duty_configurations.duty_location_id = save_duty_configuration.location_id
        and (configuration_id is null or duty_configurations.id is distinct from configuration_id)
        and (
          duty_configurations.post_id is distinct from post_id
          or duty_configurations.duty_shift_id is distinct from shift_id
        )
    );
  end if;

  if shift_id is not null then
    shift_shared := exists (
      select 1
      from public.personnel_assignments
      where personnel_assignments.duty_shift_id = save_duty_configuration.shift_id
        and (
          personnel_assignments.post_id is distinct from post_id
          or personnel_assignments.duty_location_id is distinct from location_id
        )
    ) or exists (
      select 1
      from public.duty_configurations
      where duty_configurations.duty_shift_id = save_duty_configuration.shift_id
        and (configuration_id is null or duty_configurations.id is distinct from configuration_id)
        and (
          duty_configurations.post_id is distinct from post_id
          or duty_configurations.duty_location_id is distinct from location_id
        )
    );
  end if;

  if post_id is not null and location_id is not null and shift_id is not null then
    select count(*)
    into assignment_count
    from public.personnel_assignments
    where personnel_assignments.post_id = save_duty_configuration.post_id
      and personnel_assignments.duty_location_id = save_duty_configuration.location_id
      and personnel_assignments.duty_shift_id = save_duty_configuration.shift_id;
  end if;

  if (post_shared or location_shared or shift_shared or (not is_active and assignment_count > 0))
    and not acknowledge_shared then
    raise exception 'This change updates a shared post, location, or shift, or deactivates a configuration used by existing assignments. Confirm the warning before saving.';
  end if;

  if post_id is null then
    insert into public.posts (name, description, is_active)
    values (post_name, post_description, is_active)
    returning id into resolved_post;
  else
    update public.posts
    set name = post_name,
        description = post_description,
        is_active = is_active
    where id = post_id
    returning id into resolved_post;
  end if;

  if location_id is null then
    insert into public.duty_locations (name, address, is_active)
    values (location_name, location_address, is_active)
    returning id into resolved_location;
  else
    update public.duty_locations
    set name = location_name,
        address = location_address,
        is_active = is_active
    where id = location_id
    returning id into resolved_location;
  end if;

  if shift_id is null then
    insert into public.duty_shifts (name, start_time, end_time, is_active)
    values (shift_name, start_time, end_time, is_active)
    returning id into resolved_shift;
  else
    update public.duty_shifts
    set name = shift_name,
        start_time = start_time,
        end_time = end_time,
        is_active = is_active
    where id = shift_id
    returning id into resolved_shift;
  end if;

  insert into public.duty_configurations (post_id, duty_location_id, duty_shift_id)
  values (resolved_post, resolved_location, resolved_shift)
  on conflict (post_id, duty_location_id, duty_shift_id)
  do update set post_id = excluded.post_id
  returning id into resolved_configuration;

  return jsonb_build_object(
    'configuration_id', resolved_configuration,
    'post_id', resolved_post,
    'location_id', resolved_location,
    'shift_id', resolved_shift
  );
exception
  when unique_violation then
    raise exception 'A post, location, shift, or duty configuration with these values already exists. Edit the existing record instead of creating a duplicate.';
end;
$$;

create or replace function public.set_duty_bundle_active(
  configuration_id uuid,
  post_id uuid,
  location_id uuid,
  shift_id uuid,
  is_active boolean,
  acknowledge_shared boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  shared boolean;
  assignment_count integer;
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR users can manage duty configurations.';
  end if;
  if post_id is null or location_id is null or shift_id is null then
    raise exception 'Choose a post, duty location, and duty shift.';
  end if;
  if configuration_id is not null and not exists (
    select 1
    from public.duty_configurations
    where id = configuration_id
      and duty_configurations.post_id = set_duty_bundle_active.post_id
      and duty_configurations.duty_location_id = set_duty_bundle_active.location_id
      and duty_configurations.duty_shift_id = set_duty_bundle_active.shift_id
  ) then
    raise exception 'The selected duty configuration does not match these records.';
  end if;

  shared := exists (
    select 1
    from public.personnel_assignments
    where (
      personnel_assignments.post_id = set_duty_bundle_active.post_id
      or personnel_assignments.duty_location_id = set_duty_bundle_active.location_id
      or personnel_assignments.duty_shift_id = set_duty_bundle_active.shift_id
    )
    and (
      personnel_assignments.post_id is distinct from set_duty_bundle_active.post_id
      or personnel_assignments.duty_location_id is distinct from set_duty_bundle_active.location_id
      or personnel_assignments.duty_shift_id is distinct from set_duty_bundle_active.shift_id
    )
  ) or exists (
    select 1
    from public.duty_configurations
    where (
      duty_configurations.post_id = set_duty_bundle_active.post_id
      or duty_configurations.duty_location_id = set_duty_bundle_active.location_id
      or duty_configurations.duty_shift_id = set_duty_bundle_active.shift_id
    )
    and (
      duty_configurations.post_id is distinct from set_duty_bundle_active.post_id
      or duty_configurations.duty_location_id is distinct from set_duty_bundle_active.location_id
      or duty_configurations.duty_shift_id is distinct from set_duty_bundle_active.shift_id
    )
  );

  select count(*)
  into assignment_count
  from public.personnel_assignments
  where personnel_assignments.post_id = set_duty_bundle_active.post_id
    and personnel_assignments.duty_location_id = set_duty_bundle_active.location_id
    and personnel_assignments.duty_shift_id = set_duty_bundle_active.shift_id;

  if (shared or (not is_active and assignment_count > 0)) and not acknowledge_shared then
    raise exception 'This duty configuration is used by existing assignments or shares a post, location, or shift. Confirm the warning before changing its status.';
  end if;

  update public.posts
  set is_active = set_duty_bundle_active.is_active
  where id = set_duty_bundle_active.post_id;
  if not found then
    raise exception 'The selected post no longer exists.';
  end if;

  update public.duty_locations
  set is_active = set_duty_bundle_active.is_active
  where id = set_duty_bundle_active.location_id;
  if not found then
    raise exception 'The selected duty location no longer exists.';
  end if;

  update public.duty_shifts
  set is_active = set_duty_bundle_active.is_active
  where id = set_duty_bundle_active.shift_id;
  if not found then
    raise exception 'The selected duty shift no longer exists.';
  end if;
end;
$$;

revoke all on function public.save_duty_configuration(
  uuid, uuid, text, text, uuid, text, text, uuid, text, text, text, boolean, boolean
) from public;
revoke all on function public.set_duty_bundle_active(
  uuid, uuid, uuid, uuid, boolean, boolean
) from public;
grant execute on function public.save_duty_configuration(
  uuid, uuid, text, text, uuid, text, text, uuid, text, text, text, boolean, boolean
) to authenticated;
grant execute on function public.set_duty_bundle_active(
  uuid, uuid, uuid, uuid, boolean, boolean
) to authenticated;

-- Phase 4 shift workdays and Phase 5 assessment tracking. Safe to re-run.

-- Additive Phase 4 schedule configuration and Phase 5 assessment tracking.
-- Does not delete attendance, profiles, or assignments.
-- No default workdays or assessment intervals are inserted.

alter table public.duty_shifts
  add column if not exists scheduled_weekdays smallint[];

alter table public.duty_shifts
  drop constraint if exists duty_shifts_weekdays_check;
alter table public.duty_shifts
  add constraint duty_shifts_weekdays_check check (
    scheduled_weekdays is null
    or (
      cardinality(scheduled_weekdays) between 1 and 7
      and scheduled_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  );

create table if not exists public.assessment_settings (
  id smallint primary key default 1 check (id = 1),
  evaluation_1_offset_days integer,
  evaluation_2_offset_days integer,
  evaluation_3_offset_days integer,
  due_soon_days integer,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint assessment_settings_complete check (
    (
      evaluation_1_offset_days is null
      and evaluation_2_offset_days is null
      and evaluation_3_offset_days is null
      and due_soon_days is null
    )
    or (
      evaluation_1_offset_days > 0
      and evaluation_2_offset_days > evaluation_1_offset_days
      and evaluation_3_offset_days > evaluation_2_offset_days
      and due_soon_days >= 0
      and evaluation_3_offset_days <= 3660
      and due_soon_days <= 3660
    )
  )
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  evaluation_number smallint not null check (evaluation_number between 1 and 3),
  start_date date not null,
  due_date date not null,
  workflow_status text not null default 'scheduled',
  latest_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint assessments_workflow_check check (
    workflow_status in (
      'scheduled',
      'submitted',
      'under_review',
      'returned_for_correction',
      'completed'
    )
  ),
  constraint assessments_employee_evaluation_unique unique (employee_id, evaluation_number)
);

create table if not exists public.assessment_events (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  previous_status text,
  new_status text not null,
  actor_id uuid not null references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists assessments_due_date_idx
  on public.assessments (due_date, evaluation_number);
create index if not exists assessment_events_assessment_idx
  on public.assessment_events (assessment_id, created_at);

alter table public.assessment_settings enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_events enable row level security;

drop policy if exists "Active users can read assessment settings" on public.assessment_settings;
create policy "Active users can read assessment settings"
  on public.assessment_settings
  for select
  to authenticated
  using ((select public.current_user_is_active()));

drop policy if exists "Authorized users can read assessments" on public.assessments;
create policy "Authorized users can read assessments"
  on public.assessments
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      employee_id = (select auth.uid())
      or (select public.current_user_has_role('hr'))
      or (
        (select public.current_user_has_role('supervisor'))
        and exists (
          select 1
          from public.personnel_assignments
          where personnel_assignments.employee_id = assessments.employee_id
            and personnel_assignments.supervisor_id = (select auth.uid())
        )
      )
    )
  );

drop policy if exists "Authorized users can read assessment events" on public.assessment_events;
create policy "Authorized users can read assessment events"
  on public.assessment_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assessments
      where assessments.id = assessment_events.assessment_id
        and (
          assessments.employee_id = (select auth.uid())
          or (select public.current_user_has_role('hr'))
          or (
            (select public.current_user_has_role('supervisor'))
            and exists (
              select 1
              from public.personnel_assignments
              where personnel_assignments.employee_id = assessments.employee_id
                and personnel_assignments.supervisor_id = (select auth.uid())
            )
          )
        )
    )
  );

revoke all on public.assessment_settings from anon, authenticated;
revoke all on public.assessments from anon, authenticated;
revoke all on public.assessment_events from anon, authenticated;
grant select on public.assessment_settings, public.assessments, public.assessment_events to authenticated;

create or replace function public.save_assessment_settings(
  evaluation_1_offset_days integer,
  evaluation_2_offset_days integer,
  evaluation_3_offset_days integer,
  due_soon_days integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can save assessment settings.';
  end if;
  if evaluation_1_offset_days is null
    or evaluation_2_offset_days is null
    or evaluation_3_offset_days is null
    or due_soon_days is null
    or evaluation_1_offset_days < 1
    or evaluation_2_offset_days <= evaluation_1_offset_days
    or evaluation_3_offset_days <= evaluation_2_offset_days
    or due_soon_days < 0
    or evaluation_3_offset_days > 3660
    or due_soon_days > 3660
  then
    raise exception 'Assessment intervals must be increasing whole days after the start date.';
  end if;

  insert into public.assessment_settings (
    id,
    evaluation_1_offset_days,
    evaluation_2_offset_days,
    evaluation_3_offset_days,
    due_soon_days,
    updated_at,
    updated_by
  )
  values (
    1,
    evaluation_1_offset_days,
    evaluation_2_offset_days,
    evaluation_3_offset_days,
    due_soon_days,
    now(),
    auth.uid()
  )
  on conflict (id) do update
  set evaluation_1_offset_days = excluded.evaluation_1_offset_days,
      evaluation_2_offset_days = excluded.evaluation_2_offset_days,
      evaluation_3_offset_days = excluded.evaluation_3_offset_days,
      due_soon_days = excluded.due_soon_days,
      updated_at = now(),
      updated_by = auth.uid();
end;
$$;

create or replace function public.sync_assessment_schedules()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.assessment_settings%rowtype;
  emp record;
  existing public.assessments%rowtype;
  offsets integer[];
  step integer;
  due date;
  inserted_count integer := 0;
  updated_count integer := 0;
  unchanged_count integer := 0;
  preserved_count integer := 0;
  missing_start integer := 0;
  new_id uuid;
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can synchronize assessment schedules.';
  end if;

  select * into settings from public.assessment_settings where id = 1;
  if settings.evaluation_1_offset_days is null then
    raise exception 'HR must save assessment intervals before schedules can be generated.';
  end if;
  offsets := array[
    settings.evaluation_1_offset_days,
    settings.evaluation_2_offset_days,
    settings.evaluation_3_offset_days
  ];

  for emp in
    select profiles.id as employee_id, personnel_assignments.start_date
    from public.profiles
    left join public.personnel_assignments
      on personnel_assignments.employee_id = profiles.id
    where profiles.role = 'employee'
      and profiles.is_active
  loop
    if emp.start_date is null then
      missing_start := missing_start + 1;
      continue;
    end if;

    for step in 1..3 loop
      due := emp.start_date + offsets[step];
      select * into existing
      from public.assessments
      where employee_id = emp.employee_id
        and evaluation_number = step;

      if not found then
        insert into public.assessments (
          employee_id,
          evaluation_number,
          start_date,
          due_date,
          workflow_status,
          updated_by
        )
        values (emp.employee_id, step, emp.start_date, due, 'scheduled', auth.uid())
        returning id into new_id;
        insert into public.assessment_events (
          assessment_id,
          previous_status,
          new_status,
          actor_id,
          note
        )
        values (new_id, null, 'scheduled', auth.uid(), 'Schedule created from the current start date.');
        inserted_count := inserted_count + 1;
      elsif existing.workflow_status <> 'scheduled' then
        preserved_count := preserved_count + 1;
      elsif existing.due_date is distinct from due or existing.start_date is distinct from emp.start_date then
        update public.assessments
        set due_date = due,
            start_date = emp.start_date,
            updated_at = now(),
            updated_by = auth.uid()
        where id = existing.id;
        insert into public.assessment_events (
          assessment_id,
          previous_status,
          new_status,
          actor_id,
          note
        )
        values (
          existing.id,
          'scheduled',
          'scheduled',
          auth.uid(),
          'Due date synchronized from the current start date. Workflow status was not changed.'
        );
        updated_count := updated_count + 1;
      else
        unchanged_count := unchanged_count + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'unchanged', unchanged_count,
    'preserved', preserved_count,
    'missing_start', missing_start
  );
end;
$$;

create or replace function public.set_assessment_workflow(
  assessment_id uuid,
  next_status text,
  note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.assessments%rowtype;
  actor_role text;
  clean_note text := nullif(btrim(coalesce(note, '')), '');
begin
  if not public.current_user_is_active() then
    raise exception 'Inactive accounts cannot change assessment status.';
  end if;
  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role not in ('hr', 'supervisor') then
    raise exception 'Only HR or the assigned supervisor can change assessment tracking status.';
  end if;
  if next_status not in ('submitted', 'under_review', 'returned_for_correction', 'completed') then
    raise exception 'That assessment status cannot be set directly.';
  end if;

  select * into row from public.assessments where id = assessment_id;
  if not found then
    raise exception 'Assessment record was not found.';
  end if;
  if actor_role = 'supervisor' then
    if next_status <> 'submitted'
      or row.workflow_status not in ('scheduled', 'returned_for_correction')
      or not exists (
        select 1
        from public.personnel_assignments
        where employee_id = row.employee_id
          and supervisor_id = auth.uid()
      )
    then
      raise exception 'Supervisors can only record submission for their own assigned personnel.';
    end if;
  elsif not (
    (row.workflow_status in ('scheduled', 'returned_for_correction') and next_status = 'submitted')
    or (row.workflow_status = 'submitted' and next_status = 'under_review')
    or (row.workflow_status = 'under_review' and next_status in ('returned_for_correction', 'completed'))
  ) then
    raise exception 'That status change is not allowed.';
  end if;
  if next_status = 'returned_for_correction' and clean_note is null then
    raise exception 'Enter a note when returning an evaluation for correction.';
  end if;
  if char_length(coalesce(clean_note, '')) > 500 then
    raise exception 'The note must be 500 characters or fewer.';
  end if;

  update public.assessments
  set workflow_status = next_status,
      latest_note = clean_note,
      updated_at = now(),
      updated_by = auth.uid()
  where id = row.id;
  insert into public.assessment_events (
    assessment_id,
    previous_status,
    new_status,
    actor_id,
    note
  )
  values (row.id, row.workflow_status, next_status, auth.uid(), clean_note);
end;
$$;

revoke all on function public.save_assessment_settings(integer, integer, integer, integer) from public;
revoke all on function public.sync_assessment_schedules() from public;
revoke all on function public.set_assessment_workflow(uuid, text, text) from public;
grant execute on function public.save_assessment_settings(integer, integer, integer, integer) to authenticated;
grant execute on function public.sync_assessment_schedules() to authenticated;
grant execute on function public.set_assessment_workflow(uuid, text, text) to authenticated;

