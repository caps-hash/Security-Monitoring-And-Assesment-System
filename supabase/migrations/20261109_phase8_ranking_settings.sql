create table if not exists public.performance_ranking_settings (
  id smallint primary key default 1 check (id = 1),
  approved boolean not null default false,
  assessment_weight smallint,
  attendance_weight smallint,
  source_note text,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint performance_ranking_weights_check check (
    (
      assessment_weight is null
      and attendance_weight is null
    )
    or (
      assessment_weight >= 0
      and attendance_weight >= 0
      and assessment_weight + attendance_weight = 100
    )
  ),
  constraint performance_ranking_approval_check check (
    (not approved)
    or (source_note is not null and char_length(source_note) between 8 and 500)
  )
);

alter table public.performance_ranking_settings enable row level security;

drop policy if exists "HR can read ranking settings" on public.performance_ranking_settings;
create policy "HR can read ranking settings"
  on public.performance_ranking_settings
  for select
  to authenticated
  using ((select public.current_user_has_role('hr')));

revoke all on public.performance_ranking_settings from anon, authenticated;
grant select on public.performance_ranking_settings to authenticated;
