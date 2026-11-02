import type { Metadata } from "next";
import { AssessmentBoard } from "@/components/assessment-board";
import { RatingConfigurationForm } from "@/components/rating-configuration-form";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
import { loadRatingConfiguration } from "@/lib/assessment/evaluation-queries";
import { loadAssessmentBoard } from "@/lib/assessment/queries";

export const metadata: Metadata = {
  title: "Assessment tracking",
};

export default async function HrAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("hr");
  const params = await searchParams;
  const [board, configuration] = await Promise.all([
    loadAssessmentBoard({ role: "hr", viewerId: profile.id }),
    loadRatingConfiguration(),
  ]);

  return (
    <DashboardPlaceholder profile={profile} role="hr">
      <AssessmentBoard actor="hr" board={board} query={readQuery(params)} />
      <RatingConfigurationForm configuration={configuration} />
    </DashboardPlaceholder>
  );
}

function readQuery(params: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return {
    status: first(params.status),
    evaluation: first(params.evaluation),
    q: first(params.q),
    supervisor: first(params.supervisor),
    from: first(params.from),
    to: first(params.to),
  };
}
