# SAMS system documentation

Security Personnel Assessment and Monitoring System (SAMS) is the personnel, attendance, and assessment application for Global Ground Force Security Agency Inc.

## Architecture

- Next.js App Router, React, and TypeScript render the interface and server actions.
- Tailwind CSS supplies the existing dashboard layout.
- Supabase Authentication stores sign-in accounts. `public.profiles` stores the application role.
- PostgreSQL, Row Level Security, and security-definer functions enforce record access.
- Private Storage buckets hold attendance photos and evaluation files.
- The service-role key is imported only through `src/lib/supabase/admin.ts`, which is marked `server-only`.

## Roles

- HR manages personnel, duty configuration, assignments, attendance monitoring, assessments, official scores, final decisions, reports, SMS logs, and the audit log.
- A supervisor sees only employees assigned to that supervisor. A supervisor can prepare and submit evaluations, but cannot change an official score or final decision.
- An employee sees only that employee's profile, assignment, attendance, and released assessment results.

## Main modules

- Personnel and account management.
- Duty posts, locations, shifts, and assignments.
- Daily time record with photo and location evidence.
- Assessment scheduling, evaluation forms, scoring, and final decision.
- SMS notification logs and reminders.
- Reports and exports.
- Audit log.

## Workflow

1. HR creates an employee or supervisor account. The temporary password is sent only when SMS is configured, and it must be changed at first sign-in.
2. HR saves a post, duty location, and shift, then assigns the employee to a supervisor.
3. The employee records Time In and Time Out from the employee dashboard.
4. HR saves assessment intervals and synchronizes schedules. No interval is invented by the application.
5. The assigned supervisor completes and submits the evaluation. HR may return it for correction.
6. HR enters the official score, releases the evaluation, and later saves and releases Passed or Not Passed.
7. HR reviews reports, SMS history, and audit events.

## Supabase integration

The browser receives only the public Supabase URL and anon key. Privileged writes use the server-side service role. RLS remains enabled. A normal authenticated session cannot change `profiles.role`, `employee_number`, or `id`.
