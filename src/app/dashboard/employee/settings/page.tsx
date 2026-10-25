import type { Metadata } from "next";
import Link from "next/link";
import { PasswordForm } from "@/app/dashboard/employee/settings/password-form";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Account settings",
};

export default async function EmployeeSettingsPage() {
  const profile = await requireRole("employee");

  return (
    <DashboardPlaceholder profile={profile} role="employee">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Account settings</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Review your account and change your sign-in password. Name, employee
            number, role, and assignment are managed by HR.
          </p>
        </div>
        <Link
          className="text-sm font-semibold text-blue-900 hover:text-blue-700"
          href="/dashboard/employee"
        >
          Back to profile
        </Link>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Name
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {[profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
              "Not provided"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email
          </dt>
          <dd className="mt-1 text-sm text-slate-900">{profile.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Employee number
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {profile.employee_number || "Not provided"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Phone
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {profile.phone || "Not provided"}
          </dd>
        </div>
      </dl>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900">Change password</h3>
        <PasswordForm />
      </div>
    </DashboardPlaceholder>
  );
}
