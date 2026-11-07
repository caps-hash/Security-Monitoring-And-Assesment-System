-- Phase 7 SMS notification log and reminder interval.
-- Additive and safe to re-run. Does not delete Phase 1-6 records.
-- No reminder interval is inserted. HR must save one before reminders are sent.

create table if not exists public.sms_settings (
  id smallint primary key default 1 check (id = 1),
  reminder_interval_days integer check (
    reminder_interval_days is null
    or reminder_interval_days between 1 and 90
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create table if not exists public.sms_notifications (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 200),
  recipient_phone text check (recipient_phone is null or char_length(recipient_phone) between 8 and 20),
  recipient_user_id uuid references public.profiles (id) on delete set null,
  employee_id uuid references public.profiles (id) on delete set null,
  recipient_role text not null check (recipient_role in ('hr', 'supervisor', 'employee')),
  notification_type text not null check (
    notification_type in (
      'account_setup',
      'evaluation_reminder_due_soon',
      'evaluation_reminder_due',
      'evaluation_reminder_overdue',
      'evaluation_submitted',
      'assessment_result',
      'final_decision',
      'sms_failure'
    )
  ),
  related_record_id uuid,
  message_content text not null check (char_length(message_content) between 1 and 320),
  provider text check (provider is null or char_length(provider) <= 40),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 120),
  delivery_status text not null check (
    delivery_status in (
      'pending',
      'processing',
      'sent',
      'delivered',
      'failed',
      'rejected',
      'not_configured'
    )
  ),
  provider_response jsonb,
  error_message text check (error_message is null or char_length(error_message) <= 180),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  retryable boolean not null default false,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists sms_notifications_employee_idx
  on public.sms_notifications (employee_id, created_at desc);
create index if not exists sms_notifications_status_idx
  on public.sms_notifications (delivery_status, created_at desc);
create index if not exists sms_notifications_type_idx
  on public.sms_notifications (notification_type, created_at desc);
create unique index if not exists sms_notifications_provider_message_uidx
  on public.sms_notifications (provider, provider_message_id)
  where provider_message_id is not null;

alter table public.sms_settings enable row level security;
alter table public.sms_notifications enable row level security;

drop policy if exists "HR can read SMS settings" on public.sms_settings;
create policy "HR can read SMS settings"
  on public.sms_settings
  for select
  to authenticated
  using ((select public.current_user_has_role('hr')));

drop policy if exists "Authorized users can read SMS notifications" on public.sms_notifications;
create policy "Authorized users can read SMS notifications"
  on public.sms_notifications
  for select
  to authenticated
  using (
    (select public.current_user_is_active())
    and (
      (select public.current_user_has_role('hr'))
      or recipient_user_id = (select auth.uid())
      or (
        recipient_role <> 'hr'
        and employee_id is not null
        and (select public.current_user_has_role('supervisor'))
        and (select public.supervisor_is_assigned(employee_id))
      )
    )
  );

revoke all on public.sms_settings, public.sms_notifications from anon, authenticated;
grant select on public.sms_settings, public.sms_notifications to authenticated;
