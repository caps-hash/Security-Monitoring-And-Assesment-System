create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'employee'
    check (role in ('hr', 'supervisor', 'employee')),
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  employee_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists phone text,
  add column if not exists employee_number text,
  add column if not exists is_active boolean not null default true;

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
grant update (first_name, last_name, phone, employee_number, is_active)
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
