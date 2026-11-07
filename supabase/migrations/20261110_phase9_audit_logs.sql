create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action_type text not null check (char_length(action_type) between 1 and 80),
  record_type text not null check (char_length(record_type) between 1 and 40),
  record_id text check (record_id is null or char_length(record_id) between 1 and 80),
  summary text not null check (char_length(summary) between 1 and 500),
  changes jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action_type, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "HR can read audit logs" on public.audit_logs;
create policy "HR can read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using ((select public.current_user_has_role('hr')));

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.employee_number is distinct from old.employee_number
    or new.id is distinct from old.id
  then
    raise exception 'Privileged profile fields cannot be changed from this session.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

revoke all on function public.protect_profile_privileges() from public, anon, authenticated;
