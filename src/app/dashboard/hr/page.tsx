import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { getHrDashboardData } from "@/lib/personnel/hr-dashboard";

export const metadata: Metadata = {
  title: "HR dashboard",
};

export default async function HrDashboardPage() {
  const data = await getHrDashboardData();
  const employees = data.staff.filter(({ profile }) => profile.role === "employee");
  const supervisors = data.staff.filter(
    ({ profile }) => profile.role === "supervisor",
  );
  const assignedEmployees = employees.filter((member) => member.assignment).length;

  const summaries = [
    {
      label: "Employees",
      value: String(employees.length),
      href: "/dashboard/hr/personnel",
      detail: "Create, edit, and assign personnel",
    },
    {
      label: "Supervisors",
      value: String(supervisors.length),
      href: "/dashboard/hr/supervisors",
      detail: "Manage supervisor accounts",
    },
    {
      label: "Assigned",
      value: String(assignedEmployees),
      href: "/dashboard/hr/personnel",
      detail: "Employees with a current assignment",
    },
    {
      label: "Duty options",
      value: String(data.posts.length + data.locations.length + data.shifts.length),
      href: "/dashboard/hr/duty",
      detail: "Duty assignment management",
    },
    {
      label: "Attendance",
      value: "DTR",
      href: "/dashboard/hr/attendance",
      detail: "Review time in, time out, and summaries",
    },
    {
      label: "Assessments",
      value: "Schedule",
      href: "/dashboard/hr/assessment",
      detail: "Track three evaluations. No scores yet.",
    },
  ];

  return (
    <DashboardPlaceholder profile={data.profile} role="hr">
      <section aria-labelledby="overview-heading">
        <h2 className="text-lg font-semibold text-slate-900" id="overview-heading">
          HR overview
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
          Manage personnel, supervisors, duty setup, attendance, and assessment
          schedules. Scoring, final decisions, and SMS are not part of this dashboard.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {summaries.map((summary) => (
            <Link
              className="rounded-lg border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
              href={summary.href}
              key={summary.label}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {summary.label}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                {summary.value}
              </p>
              <p className="mt-1 text-sm text-slate-600">{summary.detail}</p>
            </Link>
          ))}
        </div>
      </section>
    </DashboardPlaceholder>
  );
}