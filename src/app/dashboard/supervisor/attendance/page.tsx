import type { Metadata } from "next";
import { AttendanceMonitor } from "@/components/attendance-monitor";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
import { loadAttendanceReport } from "@/lib/attendance/report-data";
import { loadAttendanceMonitor, readAttendanceFilters } from "@/lib/attendance/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Assigned attendance",
};

export default async function SupervisorAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("supervisor");
  const params = await searchParams;
  const report = await loadAttendanceReport({
    role: "supervisor",
    viewerId: profile.id,
    params,
  });
  const filters = readAttendanceFilters(params);
  if (report.report) {
    filters.from = report.report.from;
    filters.to = report.report.to;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personnel_assignments")
    .select("employee_id")
    .eq("supervisor_id", profile.id);
  if (error) {
    throw new Error(`Unable to load assigned personnel: ${error.message}`);
  }
  const monitor = await loadAttendanceMonitor(
    filters,
    (data ?? []).map((assignment) => assignment.employee_id),
  );

  return (
    <DashboardPlaceholder profile={profile} role="supervisor">
      <AttendanceMonitor
        basePath="/dashboard/supervisor/attendance"
        data={monitor}
        description="Only personnel assigned to you are listed. Unrelated attendance records are not available here."
        report={report}
      />
    </DashboardPlaceholder>
  );
}
