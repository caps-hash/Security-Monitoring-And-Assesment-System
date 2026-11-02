-- Phase 6 evaluation forms, scoring configuration, and final decisions.
-- Additive and safe to re-run. Does not delete Phase 1–5 records.
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
