-- Additive only. Does not rewrite or delete existing profile rows.
alter table public.profiles
  add column if not exists middle_name text,
  add column if not exists email_notice_status text,
  add column if not exists sms_notice_status text;

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

revoke update (employee_number, email_notice_status, sms_notice_status)
  on public.profiles from authenticated;
grant update (first_name, middle_name, last_name, phone, is_active)
  on public.profiles to authenticated;
