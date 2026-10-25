# Security Personnel Assessment System

Phase 1 foundation for Global Ground Force Security Agency Inc. The application
uses Next.js, TypeScript, Tailwind CSS, Supabase Authentication, and PostgreSQL.

## Requirements

- Node.js 20.9 or newer
- A Supabase project

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the
   project's Supabase URL and public anon/publishable key. Set
   `SUPABASE_SERVICE_ROLE_KEY` to the project's service-role key in the server
   environment so HR can send staff invitations. Never expose this key in a
   `NEXT_PUBLIC_` variable.
4. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
   The script is safe to re-run and creates the profile, personnel, assignment,
   and row-level security policies used by the app.
5. Create the initial HR account in Supabase Authentication. New auth accounts
   default to the `employee` role. Promote the first HR account from the trusted
   SQL Editor, for example:

   ```sql
   update public.profiles
   set role = 'hr'
   where email = 'hr@example.com';
   ```

   HR can then invite employees and supervisors from the HR dashboard. Ensure
   Supabase Auth email delivery is configured so staff can accept invitations.
   Role values are `hr`, `supervisor`, and `employee`; role changes are not
   exposed in the application.
6. Start the app with `npm run dev` and open
   [http://localhost:3000](http://localhost:3000).

The Supabase service-role key is used only by server-side account invitations
and must never be placed in a `NEXT_PUBLIC_` variable or exposed to the browser.

## Phase 1 and 2 behavior

- Sign-in uses Supabase email/password authentication.
- Sign-out clears the Supabase session.
- Dashboard routes verify the authenticated user and read their role from
  `public.profiles` on the server. A user entering another role's dashboard is
  redirected to their own.
- Supabase session cookies are refreshed for dashboard requests.
- HR can invite employee and supervisor accounts, edit staff profiles,
  activate/deactivate accounts, manage posts, duty locations, and shifts, and
  assign employees to a supervisor and post with location, shift, and start date.
- Supervisors can see only employees assigned to them. Employees can see only
  their own profile and assignment.
- Account deactivation blocks application access; HR can reactivate an account.
- DTR, assessment scoring, SMS, and reports are not part of Phase 2.

## Phase 3 behavior

- Employees can open their profile dashboard and a separate account-settings page.
- The profile shows the assigned post, duty location, duty shift, and start date.
- Assessment status and the DTR summary are labeled placeholders. They do not record attendance or scores.
- Employees can change their own Supabase password after entering the current password. The minimum length is 6 characters, matching Supabase's default password policy.
- Employees cannot edit HR-controlled fields such as name, role, status, phone, employee number, or assignment. No new profile-update policy was added.
