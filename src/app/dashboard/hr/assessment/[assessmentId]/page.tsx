import type { Metadata } from "next";
import Link from "next/link";
import { HrEvaluationPanel } from "@/components/hr-evaluation-panel";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { loadEvaluationDetail } from "@/lib/assessment/evaluation-queries";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Review evaluation",
};

export default async function HrEvaluationPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const profile = await requireRole("hr");
  const { assessmentId } = await params;
  const detail = await loadEvaluationDetail(assessmentId, "hr", profile.id);

  return (
    <DashboardPlaceholder profile={profile} role="hr">
      <Link className="text-sm font-semibold text-blue-900 hover:text-blue-700" href="/dashboard/hr/assessment">
        Back to assessment tracking
      </Link>
      <div className="mt-4">
        <HrEvaluationPanel detail={detail} />
      </div>
    </DashboardPlaceholder>
  );
}
