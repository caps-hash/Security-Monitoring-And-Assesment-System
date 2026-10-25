import type { Metadata } from "next";
import { AssessmentBoard } from "@/components/assessment-board";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
import { loadAssessmentBoard } from "@/lib/assessment/queries";

export const metadata: Metadata = {
  title: "Assigned assessments",
};

export default async function SupervisorAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("supervisor");
  const params = await searchParams;
  const board = await loadAssessmentBoard({ role: "supervisor", viewerId: profile.id });
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

  return (
    <DashboardPlaceholder profile={profile} role="supervisor">
      <AssessmentBoard
        actor="supervisor"
        board={board}
        query={{
          status: first(params.status),
          evaluation: first(params.evaluation),
          q: first(params.q),
          supervisor: "",
          from: first(params.from),
          to: first(params.to),
        }}
      />
    </DashboardPlaceholder>
  );
}
