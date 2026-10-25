import type { Metadata } from "next";
import { SupervisorDirectory } from "@/components/hr-management";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { getHrDashboardData } from "@/lib/personnel/hr-dashboard";

export const metadata: Metadata = {
  title: "Supervisors",
};

export default async function HrSupervisorsPage() {
  const data = await getHrDashboardData();

  return (
    <DashboardPlaceholder profile={data.profile} role="hr">
      <SupervisorDirectory staff={data.staff} />
    </DashboardPlaceholder>
  );
}
