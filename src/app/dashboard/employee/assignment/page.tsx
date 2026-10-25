import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { EmployeeAssignmentDetails } from "@/components/employee-assignment-details";
import { requireRole } from "@/lib/auth/profile";
import { getEmployeeAssignment } from "@/lib/personnel/employee-assignment";

export const metadata: Metadata = {
  title: "My assignment",
};

export default async function EmployeeAssignmentPage() {
  const profile = await requireRole("employee");
  const assignment = await getEmployeeAssignment(profile.id);

  return (
    <DashboardPlaceholder profile={profile} role="employee">
      <EmployeeAssignmentDetails assignment={assignment} />
      <p className="mt-6 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
        Assignment information is read-only. Contact HR for changes.
      </p>
    </DashboardPlaceholder>
  );
}
