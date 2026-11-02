import type { Metadata } from "next";
import Link from "next/link";
import { EvaluationForm } from "@/components/evaluation-form";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { loadEvaluationDetail } from "@/lib/assessment/evaluation-queries";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Complete evaluation",
};

export default async function SupervisorEvaluationPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const profile = await requireRole("supervisor");
  const { assessmentId } = await params;
  const detail = await loadEvaluationDetail(assessmentId, "supervisor", profile.id);

  return (
    <DashboardPlaceholder profile={profile} role="supervisor">
      <Link className="text-sm font-semibold text-blue-900 hover:text-blue-700" href="/dashboard/supervisor/assessment">
        Back to assigned assessments
      </Link>
      <div className="mt-4">
        <EvaluationForm actor="supervisor" detail={detail} />
      </div>
    </DashboardPlaceholder>
  );
}
