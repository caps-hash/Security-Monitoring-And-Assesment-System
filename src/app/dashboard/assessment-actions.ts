"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { allowedTransitions, validateAssessmentSettings, type WorkflowStatus } from "@/lib/assessment/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AssessmentActionState = { error: string | null; success: string | null };

function failed(message: string): AssessmentActionState {
  return { error: message, success: null };
}

export async function saveAssessmentSettings(
  _previous: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can save assessment intervals.");
  }
  const settings = {
    evaluation1OffsetDays: integerField(formData, "evaluation1"),
    evaluation2OffsetDays: integerField(formData, "evaluation2"),
    evaluation3OffsetDays: integerField(formData, "evaluation3"),
    dueSoonDays: integerField(formData, "dueSoon"),
  };
  const invalid = validateAssessmentSettings(settings);
  if (invalid || settings.evaluation1OffsetDays == null || settings.evaluation2OffsetDays == null || settings.evaluation3OffsetDays == null || settings.dueSoonDays == null) {
    return failed(invalid ?? "Enter all assessment intervals.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_assessment_settings", {
    evaluation_1_offset_days: settings.evaluation1OffsetDays,
    evaluation_2_offset_days: settings.evaluation2OffsetDays,
    evaluation_3_offset_days: settings.evaluation3OffsetDays,
    due_soon_days: settings.dueSoonDays,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateAssessment();
  return { error: null, success: "Assessment intervals saved. Synchronize schedules to apply them." };
}

export async function syncAssessmentSchedules(
  _previous: AssessmentActionState,
): Promise<AssessmentActionState> {
  void _previous;
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can synchronize assessment schedules.");
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("sync_assessment_schedules");
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateAssessment();
  const result = data ?? { inserted: 0, updated: 0, unchanged: 0, preserved: 0, missing_start: 0 };
  return {
    error: null,
    success: `Schedules synchronized. Created ${result.inserted}, updated ${result.updated}, unchanged ${result.unchanged}, preserved ${result.preserved}, missing start date ${result.missing_start}.`,
  };
}

export async function setAssessmentWorkflow(
  _previous: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr" && profile.role !== "supervisor") {
    return failed("You cannot change assessment tracking status.");
  }
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "") as WorkflowStatus;
  const note = String(formData.get("note") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) {
    return failed("Choose an evaluation.");
  }
  const supabase = await createSupabaseServerClient();
  const current = await supabase
    .from("assessments")
    .select("workflow_status, employee_id")
    .eq("id", assessmentId)
    .maybeSingle();
  if (current.error || !current.data) {
    return failed(current.error ? schemaMessage(current.error.message) : "Assessment record was not found.");
  }
  if (!allowedTransitions(current.data.workflow_status, profile.role).includes(nextStatus)) {
    return failed("That status change is not allowed.");
  }
  if (profile.role === "supervisor") {
    const assigned = await supabase
      .from("personnel_assignments")
      .select("employee_id")
      .eq("employee_id", current.data.employee_id)
      .eq("supervisor_id", profile.id)
      .maybeSingle();
    if (assigned.error || !assigned.data) {
      return failed("Supervisors can only record submission for assigned personnel.");
    }
  }
  const { error } = await supabase.rpc("set_assessment_workflow", {
    assessment_id: assessmentId,
    next_status: nextStatus,
    note,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateAssessment();
  return { error: null, success: "Assessment tracking status updated. No score or final decision was recorded." };
}

function integerField(formData: FormData, name: string): number | null {
  const value = String(formData.get(name) ?? "").trim();
  if (!/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}

function schemaMessage(message: string): string {
  return /assessment_settings|assessments|schema cache|does not exist/i.test(message)
    ? "Assessment tracking is unavailable until supabase/schema.sql is applied."
    : message;
}

function revalidateAssessment(): void {
  revalidatePath("/dashboard/hr/assessment");
  revalidatePath("/dashboard/supervisor/assessment");
  revalidatePath("/dashboard/employee/assessment");
  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/hr");
}
