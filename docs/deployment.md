# SAMS deployment guide

Do not deploy until the production environment variables and database have been reviewed. This repository does not deploy itself.

## Prerequisites

- Node.js 20.9 or newer.
- A Supabase project with Authentication, Database, and Storage enabled.
- A Vercel project connected to this repository, if Vercel is the host.
- Optional SMS and email provider accounts.

## Environment variables

Copy `.env.example` and set real values only in the host's secret store.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Required for the features that use them:

- `RESEND_API_KEY` and `EMAIL_FROM` for account email.
- Twilio or Semaphore variables for SMS.
- `SMS_CRON_SECRET` or `CRON_SECRET` for the reminder route.
- `SMS_WEBHOOK_SECRET` for provider callbacks.
- `ATTENDANCE_GEOCODING_URL` only when reverse geocoding is wanted. It must be an HTTPS URL containing `{lat}` and `{lng}`.

Never commit `.env.local` or paste a service-role key into a public variable.

## Supabase setup

1. Run `supabase/schema.sql` in the SQL Editor for a new project, or apply missing files from `supabase/migrations/` without dropping existing tables.
2. Confirm `public.audit_logs` exists if Phase 9 was added separately.
3. Confirm the private `attendance-evidence` and `evaluation-documents` buckets and their policies exist.
4. Create the first HR account and promote its profile role.
5. In Authentication settings, keep the site URL and redirect URLs aligned with the deployed domain.

## Vercel

1. Import the repository. The Next.js build command is `npm run build`.
2. Add the environment variables above to Production, and to Preview only when that preview may use a non-production Supabase project.
3. `vercel.json` schedules `/api/sms/reminders` daily at 01:00 UTC. Vercel sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set. The route also accepts `SMS_CRON_SECRET`.
4. Set the SMS provider callback to `https://<domain>/api/sms/webhook` and protect it with `SMS_WEBHOOK_SECRET` or the Twilio signature.
5. Deploy only after review. Do not trigger a production deployment from an unreviewed local change.

Server actions accept uploads up to 8 MB. The attendance and evaluation validators still reject files that exceed their own limits.

## Domain

In Vercel, add the custom domain and complete the DNS record Vercel displays. Then add that exact origin to the Supabase Authentication URL settings. Use HTTPS. No application code change is required for a domain by itself.

## Backup

Use the Supabase project backup or point-in-time recovery available on the project's plan before a demonstration and before any manual SQL change. Export critical tables from the Supabase dashboard when a file copy is needed. Do not use production data for destructive tests, and do not run a database reset as a backup method.

## Local production check

Run `npm run lint`, `npm test`, and `npm run build`. These checks do not prove live login, camera, GPS, storage, or SMS delivery.
