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
