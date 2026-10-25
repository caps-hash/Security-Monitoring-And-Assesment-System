import type { Metadata } from "next";
import { AttendanceMonitor } from "@/components/attendance-monitor";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
import { loadAttendanceReport } from "@/lib/attendance/report-data";
import { loadAttendanceMonitor, readAttendanceFilters } from "@/lib/attendance/queries";

export const metadata: Metadata = {
  title: "Attendance monitoring",
};

export default async function HrAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("hr");
  const params = await searchParams;
  const report = await loadAttendanceReport({ role: "hr", viewerId: profile.id, params });
  const filters = readAttendanceFilters(params);
  if (report.report) {
    filters.from = report.report.from;
    filters.to = report.report.to;
  }
  const data = await loadAttendanceMonitor(filters, null);

  return (
    <DashboardPlaceholder profile={profile} role="hr">
      <AttendanceMonitor
        basePath="/dashboard/hr/attendance"
        data={data}
        description="HR can review attendance for personnel. This page does not approve, correct, or delete records."
        report={report}
      />
    </DashboardPlaceholder>
  );
}
