import type { Metadata } from "next";
import Link from "next/link";
import { AssessmentBoard } from "@/components/assessment-board";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { loadAssessmentBoard } from "@/lib/assessment/queries";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Assessment status",
};

export default async function EmployeeAssessmentPage() {
  const profile = await requireRole("employee");
  const board = await loadAssessmentBoard({ role: "employee", viewerId: profile.id });

  return (
    <DashboardPlaceholder profile={profile} role="employee">
      <AssessmentBoard actor="employee" board={board} />
      <p className="mt-6 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
        Official scores, ratings, and the final decision are not released in this phase.{" "}
        <Link className="font-semibold text-blue-900 hover:text-blue-700" href="/dashboard/employee">
          Return to the dashboard
        </Link>
        .
      </p>
    </DashboardPlaceholder>
  );
}
