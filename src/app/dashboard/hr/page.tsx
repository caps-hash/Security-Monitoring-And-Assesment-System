import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { getHrDashboardData } from "@/lib/personnel/hr-dashboard";
import { loadHrAnalytics } from "@/lib/reports/load";

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
  const analytics = await loadHrAnalytics();

  const summaries = [
    {
      label: "Employees",
      value: String(employees.length),
      href: "/dashboard/hr/personnel",
    },
    {
      label: "Supervisors",
      value: String(supervisors.length),
      href: "/dashboard/hr/supervisors",
    },
    {
      label: "Assigned",
      value: String(assignedEmployees),
      href: "/dashboard/hr/personnel",
    },
    {
      label: "Duty options",
      value: String(data.posts.length + data.locations.length + data.shifts.length),
      href: "/dashboard/hr/duty",
    },
    {
      label: "Attendance",
      value: "DTR",
      href: "/dashboard/hr/attendance",
    },
    {
      label: "Assessments",
      value: analytics ? String(analytics.overdue) : "Schedule",
      href: "/dashboard/hr/assessment",
    },
    {
      label: "SMS",
      value: "Logs",
      href: "/dashboard/hr/sms",
    },
    {
      label: "Reports",
      value: analytics ? String(analytics.completed) : "Analytics",
      href: "/dashboard/hr/reports",
    },
  ];

  return (
    <DashboardPlaceholder profile={data.profile} role="hr">
      <section aria-labelledby="overview-heading">
        <h2 className="text-lg font-semibold text-slate-900" id="overview-heading">
          HR overview
        </h2>
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
            </Link>
          ))}
        </div>
      </section>
    </DashboardPlaceholder>
  );
}