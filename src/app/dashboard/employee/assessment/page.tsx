import type { Metadata } from "next";
import Link from "next/link";
import { AssessmentBoard } from "@/components/assessment-board";
import { EmployeeEvaluationResults } from "@/components/employee-evaluation-results";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { loadReleasedEvaluations } from "@/lib/assessment/evaluation-queries";
import { loadAssessmentBoard } from "@/lib/assessment/queries";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Assessment status",
};

export default async function EmployeeAssessmentPage() {
  const profile = await requireRole("employee");
  const [board, released] = await Promise.all([
    loadAssessmentBoard({ role: "employee", viewerId: profile.id }),
    loadReleasedEvaluations(profile.id),
  ]);

  return (
    <DashboardPlaceholder profile={profile} role="employee">
      <AssessmentBoard actor="employee" board={board} />
      <EmployeeEvaluationResults
        finalDecision={released.finalDecision}
        items={released.items}
        message={released.ready ? null : released.message}
      />
      <p className="mt-6 text-sm leading-6 text-slate-600">
        <Link className="font-semibold text-blue-900 hover:text-blue-700" href="/dashboard/employee">
          Return to the dashboard
        </Link>
        .
      </p>
    </DashboardPlaceholder>
  );
}
