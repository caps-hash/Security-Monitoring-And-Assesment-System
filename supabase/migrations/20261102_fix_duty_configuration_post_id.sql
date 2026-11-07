-- Qualify post_id in save_duty_configuration.
-- The function parameter and duty_configurations.post_id share a name, so
-- `post_id = post_id` raises: column reference "post_id" is ambiguous.
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
    where duty_configurations.id = save_duty_configuration.configuration_id
      and duty_configurations.post_id = save_duty_configuration.post_id
      and duty_configurations.duty_location_id = save_duty_configuration.location_id
      and duty_configurations.duty_shift_id = save_duty_configuration.shift_id
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


