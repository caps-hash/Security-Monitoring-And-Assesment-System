"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/profile";
import { validateRankingWeights } from "@/lib/reports/model";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RankingActionState = { error: string | null; success: string | null };

export async function saveRankingWeights(
  _previous: RankingActionState,
  formData: FormData,
): Promise<RankingActionState> {
  const profile = await requireRole("hr");
  const assessment = wholeNumber(formData.get("assessmentWeight"));
  const attendance = wholeNumber(formData.get("attendanceWeight"));
  const sourceNote = String(formData.get("sourceNote") ?? "").trim();
  const approve = formData.get("approve") === "on";
  const invalid = validateRankingWeights({
    assessmentWeight: assessment,
    attendanceWeight: attendance,
    sourceNote,
    approve,
  });
  if (invalid) {
    return { error: invalid, success: null };
  }
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("performance_ranking_settings").upsert({
      id: 1,
      approved: approve,
      assessment_weight: assessment,
      attendance_weight: attendance,
      source_note: sourceNote,
      approved_by: approve ? profile.id : null,
      approved_at: approve ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return { error: "Ranking settings are unavailable until the Phase 8 migration is applied.", success: null };
    }
  } catch {
    return { error: "Ranking settings need SUPABASE_SERVICE_ROLE_KEY on the server.", success: null };
  }
  revalidatePath("/dashboard/hr/reports");
  return {
    error: null,
    success: approve
      ? "Ranking weights saved and approved. Missing data is still not treated as zero."
      : "Weights saved, but combined ranking stays off until HR approves them.",
  };
}

function wholeNumber(value: FormDataEntryValue | null): number | null {
  const parsed = Number(String(value ?? ""));
  return Number.isInteger(parsed) ? parsed : null;
}
