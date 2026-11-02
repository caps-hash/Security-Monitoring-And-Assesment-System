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
  if next_status not in ('under_review', 'returned_for_correction') then
    raise exception 'Submission, completion, and release are recorded through the evaluation form.';
  end if;

  select * into row from public.assessments where id = assessment_id;
  if not found then
    raise exception 'Assessment record was not found.';
  end if;
  if actor_role <> 'hr' then
    raise exception 'Only HR can accept or return an evaluation. Supervisors submit the digital form.';
  end if;
  if not (
    (row.workflow_status = 'submitted' and next_status = 'under_review')
    or (row.workflow_status in ('submitted', 'under_review') and next_status = 'returned_for_correction')
  ) then
    raise exception 'That status change is not allowed. Completion uses the evaluation release action.';
  end if;
  if next_status = 'returned_for_correction' and clean_note is null then
    raise exception 'Enter a correction reason when returning an evaluation.';
  end if;
  if char_length(coalesce(clean_note, '')) > 1000 then
    raise exception 'The note must be 1000 characters or fewer.';
  end if;

  update public.assessments
  set workflow_status = next_status,
      latest_note = case
        when next_status = 'returned_for_correction' then 'Returned for correction.'
        else clean_note
      end,
      updated_at = now(),
      updated_by = auth.uid()
  where id = row.id;
  if next_status = 'returned_for_correction' then
    insert into public.evaluation_corrections (assessment_id, remarks, reviewer_id)
    values (row.id, clean_note, auth.uid());
    update public.evaluation_forms
    set form_status = 'draft',
        updated_at = now()
    where assessment_id = row.id;
  end if;
  insert into public.assessment_events (
    assessment_id,
    previous_status,
    new_status,
    actor_id,
    note
  )
  values (
    row.id,
    row.workflow_status,
    next_status,
    auth.uid(),
    case
      when next_status = 'returned_for_correction' then 'Returned for correction.'
      else clean_note
    end
  );
end;
$$;

revoke all on function public.save_assessment_settings(integer, integer, integer, integer) from public;
revoke all on function public.sync_assessment_schedules() from public;
revoke all on function public.set_assessment_workflow(uuid, text, text) from public;
grant execute on function public.save_assessment_settings(integer, integer, integer, integer) to authenticated;
grant execute on function public.sync_assessment_schedules() to authenticated;
grant execute on function public.set_assessment_workflow(uuid, text, text) to authenticated;


-- Phase 6 evaluation forms. The migration is authoritative and safe to re-run.

-- Phase 6 evaluation forms, scoring configuration, and final decisions.
-- Additive and safe to re-run. Does not delete Phase 1â€“5 records.
-- Supervisor criterion ratings are not converted into official scores.
-- No rating band is inserted. HR must enter and approve a configuration.

create table if not exists public.evaluation_forms (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references public.assessments (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  supervisor_id uuid not null references public.profiles (id),
  evaluation_number smallint not null check (evaluation_number between 1 and 3),
  position_title text,
  department_section text,
  evaluation_date date,
  form_status text not null default 'draft' check (form_status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluation_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.evaluation_forms (id) on delete cascade,
  criterion_code text not null,
  rating text,
  comments text,
  updated_at timestamptz not null default now(),
  constraint evaluation_responses_unique unique (form_id, criterion_code),
  constraint evaluation_responses_code_check check (
    criterion_code in (
      'job_knowledge',
      'productivity',
      'quality',
      'customer_relations',
      'job_attitude',
      'dependability',
      'cooperation',
      'initiative',
      'housekeeping',
      'attendance',
      'discipline'
    )
  ),
  constraint evaluation_responses_rating_check check (
    rating is null
    or rating in (
      'exceeds_requirements',
      'meets_requirements',
      'does_not_meet_requirements'
    )
  ),
  constraint evaluation_responses_comments_check check (
    comments is null or char_length(comments) <= 1000
  )
);

create table if not exists public.evaluation_files (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 5000000),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_corrections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  remarks text not null check (char_length(remarks) between 1 and 1000),
  reviewer_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_results (
  assessment_id uuid primary key references public.assessments (id) on delete cascade,
  official_score numeric(6, 2) check (official_score is null or official_score between 0 and 100),
  calculated_rating text,
  rating_basis text not null default 'unconfigured' check (
    rating_basis in ('unconfigured', 'approved_configuration')
  ),
  hr_feedback text check (hr_feedback is null or char_length(hr_feedback) <= 2000),
  recommendation text check (
    recommendation is null
    or recommendation in (
      'absorption_to_regular_plantilla',
      'extension_of_contract',
      'transfer_to_another_assignment',
      'finish_or_terminate_contract'
    )
  ),
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  released_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluation_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  kind text not null check (kind in ('rated_by', 'acknowledge_by', 'noted_by_hro')),
  actor_id uuid not null references public.profiles (id),
  acknowledged_at timestamptz not null default now(),
  constraint evaluation_acknowledgments_unique unique (assessment_id, kind)
);

create table if not exists public.final_decisions (
  employee_id uuid primary key references public.profiles (id) on delete cascade,
  decision text not null check (decision in ('passed', 'not_passed')),
  remark text check (remark is null or char_length(remark) <= 1000),
  issued_by uuid not null references public.profiles (id),
  issued_at timestamptz not null default now(),
  released_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.rating_configurations (
  id smallint primary key default 1 check (id = 1),
  approved boolean not null default false,
  source_note text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint rating_configurations_approval_check check (
    (not approved and approved_at is null)
    or (approved and source_note is not null and char_length(source_note) between 8 and 500)
  )
);

create table if not exists public.rating_bands (
  id uuid primary key default gen_random_uuid(),
  configuration_id smallint not null references public.rating_configurations (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  min_score numeric(6, 2) not null,
  max_score numeric(6, 2) not null,
  sort_order smallint not null,
  constraint rating_bands_range_check check (min_score <= max_score),
  constraint rating_bands_label_unique unique (configuration_id, label)
);

create index if not exists evaluation_files_assessment_idx
  on public.evaluation_files (assessment_id, created_at);
create index if not exists evaluation_corrections_assessment_idx
  on public.evaluation_corrections (assessment_id, created_at desc);
create index if not exists evaluation_results_released_idx
  on public.evaluation_results (released_at);

alter table public.evaluation_forms enable row level security;
alter table public.evaluation_responses enable row level security;
alter table public.evaluation_files enable row level security;
alter table public.evaluation_corrections enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.evaluation_acknowledgments enable row level security;
alter table public.final_decisions enable row level security;
alter table public.rating_configurations enable row level security;
alter table public.rating_bands enable row level security;

create or replace function public.evaluation_result_is_released(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evaluation_results
    where assessment_id = target_assessment_id
      and released_at is not null
  );
$$;

create or replace function public.supervisor_is_assigned(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.personnel_assignments
    where employee_id = target_employee_id
      and supervisor_id = (select auth.uid())
  );
$$;

drop policy if exists "Authorized users can read evaluation forms" on public.evaluation_forms;
create policy "Authorized users can read evaluation forms"
  on public.evaluation_forms
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      (select public.current_user_has_role('hr'))
      or (
        (select public.current_user_has_role('supervisor'))
        and (select public.supervisor_is_assigned(employee_id))
      )
      or (
        employee_id = (select auth.uid())
        and (select public.evaluation_result_is_released(assessment_id))
      )
    )
  );

drop policy if exists "Authorized users can read evaluation responses" on public.evaluation_responses;
create policy "Authorized users can read evaluation responses"
  on public.evaluation_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.evaluation_forms
      where evaluation_forms.id = evaluation_responses.form_id
    )
  );

drop policy if exists "Authorized users can read evaluation files" on public.evaluation_files;
create policy "Authorized users can read evaluation files"
  on public.evaluation_files
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      (select public.current_user_has_role('hr'))
      or (
        (select public.current_user_has_role('supervisor'))
        and exists (
          select 1
          from public.assessments
          where assessments.id = evaluation_files.assessment_id
            and (select public.supervisor_is_assigned(assessments.employee_id))
        )
      )
    )
  );

drop policy if exists "Authorized users can read evaluation corrections" on public.evaluation_corrections;
create policy "Authorized users can read evaluation corrections"
  on public.evaluation_corrections
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      (select public.current_user_has_role('hr'))
      or (
        (select public.current_user_has_role('supervisor'))
        and exists (
          select 1
          from public.assessments
          where assessments.id = evaluation_corrections.assessment_id
            and (select public.supervisor_is_assigned(assessments.employee_id))
        )
      )
    )
  );

drop policy if exists "Authorized users can read evaluation results" on public.evaluation_results;
create policy "Authorized users can read evaluation results"
  on public.evaluation_results
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      (select public.current_user_has_role('hr'))
      or (
        released_at is not null
        and exists (
          select 1
          from public.assessments
          where assessments.id = evaluation_results.assessment_id
            and (
              assessments.employee_id = (select auth.uid())
              or (
                (select public.current_user_has_role('supervisor'))
                and (select public.supervisor_is_assigned(assessments.employee_id))
              )
            )
        )
      )
    )
  );

drop policy if exists "Authorized users can read evaluation acknowledgments" on public.evaluation_acknowledgments;
create policy "Authorized users can read evaluation acknowledgments"
  on public.evaluation_acknowledgments
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and exists (
      select 1
      from public.assessments
      where assessments.id = evaluation_acknowledgments.assessment_id
        and (
          (select public.current_user_has_role('hr'))
          or (
            (select public.current_user_has_role('supervisor'))
            and (select public.supervisor_is_assigned(assessments.employee_id))
          )
          or (
            assessments.employee_id = (select auth.uid())
            and (select public.evaluation_result_is_released(assessments.id))
          )
        )
    )
  );

drop policy if exists "Authorized users can read final decisions" on public.final_decisions;
create policy "Authorized users can read final decisions"
  on public.final_decisions
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      (select public.current_user_has_role('hr'))
      or (
        released_at is not null
        and (
          employee_id = (select auth.uid())
          or (
            (select public.current_user_has_role('supervisor'))
            and (select public.supervisor_is_assigned(employee_id))
          )
        )
      )
    )
  );

drop policy if exists "HR can read rating configuration" on public.rating_configurations;
create policy "HR can read rating configuration"
  on public.rating_configurations
  for select
  to authenticated
  using ((select public.current_user_has_role('hr')));

drop policy if exists "HR can read rating bands" on public.rating_bands;
create policy "HR can read rating bands"
  on public.rating_bands
  for select
  to authenticated
  using ((select public.current_user_has_role('hr')));

revoke all on public.evaluation_forms, public.evaluation_responses, public.evaluation_files,
  public.evaluation_corrections, public.evaluation_results, public.evaluation_acknowledgments,
  public.final_decisions, public.rating_configurations, public.rating_bands
  from anon, authenticated;
grant select on public.evaluation_forms, public.evaluation_responses, public.evaluation_files,
  public.evaluation_corrections, public.evaluation_results, public.evaluation_acknowledgments,
  public.final_decisions, public.rating_configurations, public.rating_bands
  to authenticated;

revoke all on function public.evaluation_result_is_released(uuid) from public;
revoke all on function public.supervisor_is_assigned(uuid) from public;

create or replace function public.approved_rating_for_score(score numeric)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  config public.rating_configurations%rowtype;
  match_count integer;
  matched_label text;
begin
  select * into config from public.rating_configurations where id = 1;
  if not found or not config.approved then
    return null;
  end if;
  select count(*)::integer, min(rating_bands.label)
    into match_count, matched_label
  from public.rating_bands
  where configuration_id = 1
    and score >= min_score
    and score <= max_score;
  if match_count = 1 then
    return matched_label;
  end if;
  return null;
end;
$$;

revoke all on function public.approved_rating_for_score(numeric) from public;

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
  if next_status not in ('under_review', 'returned_for_correction') then
    raise exception 'Submission, completion, and release are recorded through the evaluation form.';
  end if;
  select * into row from public.assessments where id = assessment_id;
  if not found then
    raise exception 'Assessment record was not found.';
  end if;
  if actor_role <> 'hr' then
    raise exception 'Only HR can accept or return an evaluation. Supervisors submit the digital form.';
  end if;
  if not (
    (row.workflow_status = 'submitted' and next_status = 'under_review')
    or (row.workflow_status in ('submitted', 'under_review') and next_status = 'returned_for_correction')
  ) then
    raise exception 'That status change is not allowed. Completion uses the evaluation release action.';
  end if;
  if next_status = 'returned_for_correction' and clean_note is null then
    raise exception 'Enter a correction reason when returning an evaluation.';
  end if;
  if char_length(coalesce(clean_note, '')) > 1000 then
    raise exception 'The note must be 1000 characters or fewer.';
  end if;

  update public.assessments
  set workflow_status = next_status,
      latest_note = case
        when next_status = 'returned_for_correction' then 'Returned for correction.'
        else clean_note
      end,
      updated_at = now(),
      updated_by = auth.uid()
  where id = row.id;
  if next_status = 'returned_for_correction' then
    insert into public.evaluation_corrections (assessment_id, remarks, reviewer_id)
    values (row.id, clean_note, auth.uid());
    update public.evaluation_forms
    set form_status = 'draft',
        updated_at = now()
    where assessment_id = row.id;
  end if;
  insert into public.assessment_events (
    assessment_id,
    previous_status,
    new_status,
    actor_id,
    note
  )
  values (
    row.id,
    row.workflow_status,
    next_status,
    auth.uid(),
    case
      when next_status = 'returned_for_correction' then 'Returned for correction.'
      else clean_note
    end
  );
end;
$$;

create or replace function public.save_evaluation_draft(
  target_assessment_id uuid,
  evaluation_date date,
  responses jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.assessments%rowtype;
  form_id uuid;
  item jsonb;
  code text;
  item_rating text;
  item_comments text;
  position_title text;
  department_section text;
begin
  if not public.current_user_is_active() or not public.current_user_has_role('supervisor') then
    raise exception 'Only the assigned supervisor can save an evaluation draft.';
  end if;
  select * into row from public.assessments where id = target_assessment_id;
  if not found then
    raise exception 'Assessment record was not found.';
  end if;
  if row.workflow_status not in ('scheduled', 'returned_for_correction') then
    raise exception 'This evaluation cannot be edited in its current status.';
  end if;
  if not public.supervisor_is_assigned(row.employee_id) then
    raise exception 'Supervisors can only evaluate assigned personnel.';
  end if;
  if jsonb_typeof(responses) <> 'array' then
    raise exception 'Evaluation responses are missing.';
  end if;

  select posts.name, duty_locations.name
    into position_title, department_section
  from public.personnel_assignments
  left join public.posts on posts.id = personnel_assignments.post_id
  left join public.duty_locations on duty_locations.id = personnel_assignments.duty_location_id
  where personnel_assignments.employee_id = row.employee_id;

  insert into public.evaluation_forms (
    assessment_id,
    employee_id,
    supervisor_id,
    evaluation_number,
    position_title,
    department_section,
    evaluation_date,
    form_status
  )
  values (
    row.id,
    row.employee_id,
    auth.uid(),
    row.evaluation_number,
    position_title,
    department_section,
    evaluation_date,
    'draft'
  )
  on conflict (assessment_id) do update
  set supervisor_id = auth.uid(),
      position_title = excluded.position_title,
      department_section = excluded.department_section,
      evaluation_date = excluded.evaluation_date,
      form_status = 'draft',
      updated_at = now()
  returning id into form_id;

  for item in select value from jsonb_array_elements(responses)
  loop
    code := item->>'code';
    item_rating := nullif(item->>'rating', '');
    item_comments := nullif(btrim(coalesce(item->>'comments', '')), '');
    if code is null or item_rating is null and item_comments is null then
      continue;
    end if;
    if char_length(coalesce(item_comments, '')) > 1000 then
      raise exception 'Criterion comments must be 1000 characters or fewer.';
    end if;
    insert into public.evaluation_responses (form_id, criterion_code, rating, comments)
    values (form_id, code, item_rating, item_comments)
    on conflict (form_id, criterion_code) do update
    set rating = excluded.rating,
        comments = excluded.comments,
        updated_at = now();
  end loop;
  return form_id;
end;
$$;

create or replace function public.submit_evaluation_form(
  target_assessment_id uuid,
  evaluation_date date,
  responses jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.assessments%rowtype;
  form_id uuid;
  response_count integer;
begin
  if evaluation_date is null then
    raise exception 'Enter the evaluation date.';
  end if;
  if evaluation_date > ((now() at time zone 'Asia/Manila')::date + 1) then
    raise exception 'The evaluation date cannot be in the future.';
  end if;
  perform public.save_evaluation_draft(target_assessment_id, evaluation_date, responses);
  select * into row from public.assessments where id = target_assessment_id;
  select id into form_id from public.evaluation_forms where assessment_id = row.id;
  select count(*) into response_count
  from public.evaluation_responses
  where form_id = form_id
    and rating is not null;
  if response_count <> 11 then
    raise exception 'Select one rating for every official criterion before submission.';
  end if;

  update public.evaluation_forms
  set form_status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  where id = form_id;

  update public.assessments
  set workflow_status = 'submitted',
      latest_note = 'Digital evaluation form submitted.',
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
  values (row.id, row.workflow_status, 'submitted', auth.uid(), 'Digital evaluation form submitted.');

  insert into public.evaluation_acknowledgments (assessment_id, kind, actor_id, acknowledged_at)
  values (row.id, 'rated_by', auth.uid(), now())
  on conflict (assessment_id, kind) do update
  set actor_id = excluded.actor_id,
      acknowledged_at = excluded.acknowledged_at;
  return form_id;
end;
$$;

create or replace function public.register_evaluation_file(
  target_assessment_id uuid,
  storage_path text,
  file_name text,
  mime_type text,
  byte_size integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.assessments%rowtype;
  file_id uuid;
begin
  if not public.current_user_is_active() or not public.current_user_has_role('supervisor') then
    raise exception 'Only the assigned supervisor can attach an evaluation file.';
  end if;
  select * into row from public.assessments where id = target_assessment_id;
  if not found or not public.supervisor_is_assigned(row.employee_id) then
    raise exception 'Supervisors can only attach files for assigned personnel.';
  end if;
  if row.workflow_status not in ('scheduled', 'returned_for_correction', 'submitted') then
    raise exception 'Files cannot be added after HR has accepted the evaluation.';
  end if;
  if storage_path !~ ('^evaluations/' || row.employee_id::text || '/' || row.id::text || '/[0-9a-f-]{36}$') then
    raise exception 'The evaluation file path is not valid.';
  end if;
  if mime_type not in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ) then
    raise exception 'That file type is not allowed.';
  end if;
  insert into public.evaluation_files (
    assessment_id,
    storage_path,
    file_name,
    mime_type,
    byte_size,
    uploaded_by
  )
  values (row.id, storage_path, left(file_name, 180), mime_type, byte_size, auth.uid())
  returning id into file_id;
  return file_id;
end;
$$;

create or replace function public.save_evaluation_result_fields(
  target_assessment_id uuid,
  official_score numeric,
  hr_feedback text,
  recommendation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.assessments%rowtype;
  clean_feedback text := nullif(btrim(coalesce(hr_feedback, '')), '');
  clean_recommendation text := nullif(recommendation, '');
  rating text;
  basis text := 'unconfigured';
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can enter official scores, feedback, or recommendations.';
  end if;
  select * into row from public.assessments where id = target_assessment_id;
  if not found or row.workflow_status <> 'under_review' then
    raise exception 'Accept the submission before entering the official result.';
  end if;
  if official_score is null or official_score < 0 or official_score > 100 then
    raise exception 'Enter an official score from 0 to 100. Supervisor ratings are not converted into this score.';
  end if;
  if clean_feedback is null or char_length(clean_feedback) > 2000 then
    raise exception 'Enter HR feedback of 2000 characters or fewer.';
  end if;
  if clean_recommendation is null then
    raise exception 'Select an HRO recommendation from the official form.';
  end if;
  rating := public.approved_rating_for_score(official_score);
  if exists (select 1 from public.rating_configurations where id = 1 and approved) then
    if rating is null then
      raise exception 'The official score does not match exactly one approved rating band.';
    end if;
    basis := 'approved_configuration';
  end if;
  insert into public.evaluation_results (
    assessment_id,
    official_score,
    calculated_rating,
    rating_basis,
    hr_feedback,
    recommendation,
    reviewer_id,
    reviewed_at
  )
  values (
    row.id,
    official_score,
    rating,
    basis,
    clean_feedback,
    clean_recommendation,
    auth.uid(),
    now()
  )
  on conflict (assessment_id) do update
  set official_score = excluded.official_score,
      calculated_rating = excluded.calculated_rating,
      rating_basis = excluded.rating_basis,
      hr_feedback = excluded.hr_feedback,
      recommendation = excluded.recommendation,
      reviewer_id = excluded.reviewer_id,
      reviewed_at = excluded.reviewed_at,
      updated_at = now()
  where evaluation_results.released_at is null;
  if not found then
    raise exception 'A released result cannot be edited.';
  end if;
end;
$$;

create or replace function public.approve_rating_configuration(
  bands jsonb,
  source_note text,
  approve_now boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_note text := nullif(btrim(coalesce(source_note, '')), '');
  item jsonb;
  band_count integer := 0;
  previous_max numeric := null;
  band_min numeric;
  band_max numeric;
  band_label text;
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can configure rating bands.';
  end if;
  if jsonb_typeof(bands) <> 'array' or jsonb_array_length(bands) < 1 then
    raise exception 'Add at least one rating band. No default range is applied.';
  end if;
  if clean_note is null or char_length(clean_note) < 8 then
    raise exception 'Describe the agency approval for these rating bands.';
  end if;
  if not exists (select 1 from public.rating_configurations where id = 1) then
    insert into public.rating_configurations (id, approved) values (1, false);
  end if;
  delete from public.rating_bands where configuration_id = 1;
  for item in
    select value
    from jsonb_array_elements(bands)
    order by (value->>'min')::numeric
  loop
    band_label := btrim(coalesce(item->>'label', ''));
    band_min := (item->>'min')::numeric;
    band_max := (item->>'max')::numeric;
    if band_label = '' or band_min is null or band_max is null or band_min > band_max then
      raise exception 'Each rating band needs a label and a minimum that does not exceed its maximum.';
    end if;
    if previous_max is not null and band_min <= previous_max then
      raise exception 'Rating bands cannot overlap.';
    end if;
    previous_max := band_max;
    band_count := band_count + 1;
    insert into public.rating_bands (configuration_id, label, min_score, max_score, sort_order)
    values (1, band_label, band_min, band_max, band_count);
  end loop;
  update public.rating_configurations
  set approved = approve_now,
      source_note = clean_note,
      approved_by = case when approve_now then auth.uid() else null end,
      approved_at = case when approve_now then now() else null end,
      updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.complete_and_release_evaluation(
  target_assessment_id uuid,
  confirm_release boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.assessments%rowtype;
  result public.evaluation_results%rowtype;
  response_count integer;
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can release an evaluation result.';
  end if;
  if confirm_release is not true then
    raise exception 'Confirm the release before saving it.';
  end if;
  select * into row from public.assessments where id = target_assessment_id;
  if not found or row.workflow_status <> 'under_review' then
    raise exception 'Accept the submission before completing it.';
  end if;
  select count(*) into response_count
  from public.evaluation_responses
  join public.evaluation_forms on evaluation_forms.id = evaluation_responses.form_id
  where evaluation_forms.assessment_id = row.id
    and evaluation_responses.rating is not null;
  if response_count <> 11 then
    raise exception 'The digital form is incomplete and cannot be released.';
  end if;
  select * into result from public.evaluation_results where assessment_id = row.id;
  if not found
    or result.official_score is null
    or result.hr_feedback is null
    or result.recommendation is null
  then
    raise exception 'Enter the official score, HRO recommendation, and HR feedback before release.';
  end if;
  if exists (select 1 from public.rating_configurations where id = 1 and approved)
    and result.calculated_rating is null
  then
    raise exception 'The approved rating configuration does not match this score.';
  end if;

  update public.evaluation_results
  set released_at = now(),
      completed_at = now(),
      reviewer_id = auth.uid(),
      updated_at = now()
  where assessment_id = row.id;
  update public.assessments
  set workflow_status = 'completed',
      latest_note = 'Evaluation result released.',
      updated_at = now(),
      updated_by = auth.uid()
  where id = row.id;
  insert into public.assessment_events (
    assessment_id, previous_status, new_status, actor_id, note
  )
  values (row.id, row.workflow_status, 'completed', auth.uid(), 'Evaluation result released.');
end;
$$;

create or replace function public.recalculate_released_ratings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer := 0;
  result record;
  rating text;
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can recalculate ratings.';
  end if;
  if not exists (select 1 from public.rating_configurations where id = 1 and approved) then
    raise exception 'Approve a rating configuration before calculating ratings.';
  end if;
  for result in
    select assessment_id, official_score
    from public.evaluation_results
    where official_score is not null
      and released_at is not null
  loop
    rating := public.approved_rating_for_score(result.official_score);
    if rating is null then
      continue;
    end if;
    update public.evaluation_results
    set calculated_rating = rating,
        rating_basis = 'approved_configuration',
        updated_at = now()
    where assessment_id = result.assessment_id
      and calculated_rating is distinct from rating;
    updated_count := updated_count + 1;
  end loop;
  return updated_count;
end;
$$;

create or replace function public.issue_final_decision(
  target_employee_id uuid,
  decision text,
  remark text,
  confirm_decision boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_remark text := nullif(btrim(coalesce(remark, '')), '');
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can issue the final decision.';
  end if;
  if confirm_decision is not true then
    raise exception 'Confirm the final decision before saving it.';
  end if;
  if decision not in ('passed', 'not_passed') then
    raise exception 'The final decision must be Passed or Not Passed.';
  end if;
  if not exists (
    select 1
    from public.assessments
    where employee_id = target_employee_id
      and evaluation_number = 3
      and workflow_status = 'completed'
  ) then
    raise exception 'Complete and release Evaluation 3 before issuing a final decision.';
  end if;
  insert into public.final_decisions (
    employee_id, decision, remark, issued_by, issued_at, released_at
  )
  values (target_employee_id, decision, clean_remark, auth.uid(), now(), null)
  on conflict (employee_id) do update
  set decision = excluded.decision,
      remark = excluded.remark,
      issued_by = excluded.issued_by,
      issued_at = excluded.issued_at,
      released_at = null,
      updated_at = now();
end;
$$;

create or replace function public.release_final_decision(
  target_employee_id uuid,
  confirm_release boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can release the final decision.';
  end if;
  if confirm_release is not true then
    raise exception 'Confirm the release before saving it.';
  end if;
  update public.final_decisions
  set released_at = now(),
      updated_at = now()
  where employee_id = target_employee_id
    and released_at is null;
  if not found then
    raise exception 'Issue the final decision before releasing it.';
  end if;
end;
$$;

create or replace function public.acknowledge_released_evaluation(target_assessment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_active() or not public.current_user_has_role('employee') then
    raise exception 'Only the employee can acknowledge a released evaluation.';
  end if;
  if not exists (
    select 1
    from public.assessments
    where id = target_assessment_id
      and employee_id = auth.uid()
  ) or not public.evaluation_result_is_released(target_assessment_id) then
    raise exception 'An evaluation can be acknowledged only after its result is released.';
  end if;
  insert into public.evaluation_acknowledgments (assessment_id, kind, actor_id)
  values (target_assessment_id, 'acknowledge_by', auth.uid())
  on conflict (assessment_id, kind) do nothing;
end;
$$;

create or replace function public.note_evaluation_as_hro(target_assessment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_has_role('hr') then
    raise exception 'Only HR can note an evaluation as Human Resource Officer.';
  end if;
  if not exists (select 1 from public.assessments where id = target_assessment_id) then
    raise exception 'Assessment record was not found.';
  end if;
  insert into public.evaluation_acknowledgments (assessment_id, kind, actor_id)
  values (target_assessment_id, 'noted_by_hro', auth.uid())
  on conflict (assessment_id, kind) do update
  set actor_id = excluded.actor_id,
      acknowledged_at = now();
end;
$$;

revoke all on function public.save_evaluation_draft(uuid, date, jsonb) from public;
revoke all on function public.submit_evaluation_form(uuid, date, jsonb) from public;
revoke all on function public.register_evaluation_file(uuid, text, text, text, integer) from public;
revoke all on function public.save_evaluation_result_fields(uuid, numeric, text, text) from public;
revoke all on function public.approve_rating_configuration(jsonb, text, boolean) from public;
revoke all on function public.complete_and_release_evaluation(uuid, boolean) from public;
revoke all on function public.recalculate_released_ratings() from public;
revoke all on function public.issue_final_decision(uuid, text, text, boolean) from public;
revoke all on function public.release_final_decision(uuid, boolean) from public;
revoke all on function public.acknowledge_released_evaluation(uuid) from public;
revoke all on function public.note_evaluation_as_hro(uuid) from public;
revoke all on function public.set_assessment_workflow(uuid, text, text) from public;

grant execute on function public.save_evaluation_draft(uuid, date, jsonb) to authenticated;
grant execute on function public.submit_evaluation_form(uuid, date, jsonb) to authenticated;
grant execute on function public.register_evaluation_file(uuid, text, text, text, integer) to authenticated;
grant execute on function public.save_evaluation_result_fields(uuid, numeric, text, text) to authenticated;
grant execute on function public.approve_rating_configuration(jsonb, text, boolean) to authenticated;
grant execute on function public.complete_and_release_evaluation(uuid, boolean) to authenticated;
grant execute on function public.recalculate_released_ratings() to authenticated;
grant execute on function public.issue_final_decision(uuid, text, text, boolean) to authenticated;
grant execute on function public.release_final_decision(uuid, boolean) to authenticated;
grant execute on function public.acknowledge_released_evaluation(uuid) to authenticated;
grant execute on function public.note_evaluation_as_hro(uuid) to authenticated;
grant execute on function public.set_assessment_workflow(uuid, text, text) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('evaluation-documents', 'evaluation-documents', false)
    on conflict (id) do update set public = false;
  end if;

  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "HR reads evaluation documents" on storage.objects';
    execute 'drop policy if exists "Supervisors read assigned evaluation documents" on storage.objects';
    execute $policy$
      create policy "HR reads evaluation documents"
        on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'evaluation-documents'
          and (select public.current_user_has_role('hr'))
        )
    $policy$;
    execute $policy$
      create policy "Supervisors read assigned evaluation documents"
        on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'evaluation-documents'
          and (select public.current_user_has_role('supervisor'))
          and (storage.foldername(name))[1] = 'evaluations'
          and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
          and (select public.supervisor_is_assigned(((storage.foldername(name))[2])::uuid))
        )
    $policy$;
  end if;
end;
$$;

