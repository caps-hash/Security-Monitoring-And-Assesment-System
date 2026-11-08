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
    </DashboardPlaceholder>
  );
}
