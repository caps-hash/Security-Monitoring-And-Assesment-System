import type { Metadata } from "next";
import { AssessmentBoard } from "@/components/assessment-board";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
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
  const board = await loadAssessmentBoard({ role: "hr", viewerId: profile.id });

  return (
    <DashboardPlaceholder profile={profile} role="hr">
      <AssessmentBoard actor="hr" board={board} query={readQuery(params)} />
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
