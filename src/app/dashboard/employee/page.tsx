import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { EmployeeAssignmentDetails } from "@/components/employee-assignment-details";
import { requireRole } from "@/lib/auth/profile";
import { getOwnAttendanceState } from "@/lib/attendance/queries";
import { getEmployeeAssignment } from "@/lib/personnel/employee-assignment";

export const metadata: Metadata = {
  title: "Employee dashboard",
};

export default async function EmployeeDashboardPage() {
  const profile = await requireRole("employee");
  const [assignment, attendance] = await Promise.all([
    getEmployeeAssignment(profile.id),
    getOwnAttendanceState(profile.id),
  ]);

  return (
    <DashboardPlaceholder profile={profile} role="employee">
      <section aria-labelledby="overview-heading">
        <h2 className="text-lg font-semibold text-slate-900" id="overview-heading">
          Employee overview
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Employee number
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {profile.employee_number || "Not provided"}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account status
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {profile.is_active ? "Active" : "Inactive"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <EmployeeAssignmentDetails assignment={assignment} />
      </div>

      <div className="mt-8 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
        <section
          aria-labelledby="assessment-heading"
          className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"
        >
          <h2
            className="text-sm font-semibold text-slate-900"
            id="assessment-heading"
          >
            Assessment status
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Open Assessment Status for your evaluation schedule. Released scores and
            the final decision appear there only after HR releases them.
          </p>
          <Link
            className="mt-3 inline-block text-sm font-semibold text-blue-900 hover:text-blue-700"
            href="/dashboard/employee/assessment"
          >
            View assessment status
          </Link>
        </section>
        <section
          aria-labelledby="dtr-heading"
          className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"
        >
          <h2 className="text-sm font-semibold text-slate-900" id="dtr-heading">
            DTR summary
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {attendance.schemaReady
              ? attendance.today
                ? `Today: Time In ${attendance.today.timeInLabel}. Time Out ${attendance.today.timeOutLabel}.`
                : "No attendance record for today."
              : "Attendance storage is not ready until supabase/schema.sql is applied."}
          </p>
          <Link
            className="mt-3 inline-block text-sm font-semibold text-blue-900 hover:text-blue-700"
            href="/dashboard/employee/dtr"
          >
            View DTR summary
          </Link>
        </section>
      </div>
    </DashboardPlaceholder>
  );
}
