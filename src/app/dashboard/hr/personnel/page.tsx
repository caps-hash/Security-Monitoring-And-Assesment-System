import type { Metadata } from "next";
import {
  CreateAccountPanel,
  EmployeeDirectory,
} from "@/components/hr-management";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { getHrDashboardData } from "@/lib/personnel/hr-dashboard";

export const metadata: Metadata = {
  title: "Personnel",
};

export default async function HrPersonnelPage() {
  const data = await getHrDashboardData();

  return (
    <DashboardPlaceholder profile={data.profile} role="hr">
      <CreateAccountPanel />
      <EmployeeDirectory
        locations={data.locations}
        posts={data.posts}
        shifts={data.shifts}
        staff={data.staff}
        supervisors={data.supervisors}
      />
    </DashboardPlaceholder>
  );
}
