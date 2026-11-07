import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { SmsLogPanel } from "@/components/sms-log-panel";
import { requireRole } from "@/lib/auth/profile";
import { loadSmsLog, readSmsFilters } from "@/lib/notifications/sms-queries";

export const metadata: Metadata = {
  title: "SMS notifications",
};

export default async function HrSmsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("hr");
  const params = await searchParams;
  const view = await loadSmsLog(readSmsFilters(params));

  return (
    <DashboardPlaceholder profile={profile} role="hr">
      <SmsLogPanel view={view} />
    </DashboardPlaceholder>
  );
}
