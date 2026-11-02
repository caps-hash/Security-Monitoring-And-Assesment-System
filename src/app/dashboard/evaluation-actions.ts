"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { EVALUATION_CRITERIA, type EvaluationRating } from "@/lib/assessment/criteria";
import { inspectEvaluationFile } from "@/lib/assessment/files";
import { validateRatingBands } from "@/lib/assessment/scoring";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EvaluationActionState = { error: string | null; success: string | null };

const BUCKET = "evaluation-documents";

function failed(message: string): EvaluationActionState {
  return { error: message, success: null };
}

export async function saveEvaluationDraft(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "supervisor") {
    return failed("Only the assigned supervisor can save an evaluation draft.");
  }
  const assessmentId = uuidField(formData, "assessmentId");
  if (!assessmentId) {
    return failed("Choose an evaluation.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_evaluation_draft", {
    target_assessment_id: assessmentId,
    evaluation_date: dateField(formData) || null,
    responses: responsesFrom(formData),
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation(assessmentId);
  return { error: null, success: "Draft saved. It has not been submitted to HR." };
}

export async function submitEvaluationForm(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "supervisor") {
    return failed("Only the assigned supervisor can submit an evaluation.");
  }
  if (String(formData.get("confirm") ?? "") !== "yes") {
    return failed("Review the form and confirm before submitting.");
  }
  const assessmentId = uuidField(formData, "assessmentId");
  const evaluationDate = dateField(formData);
  if (!assessmentId || !evaluationDate) {
    return failed("Choose an evaluation and enter the evaluation date.");
  }
  const responses = responsesFrom(formData);
  if (responses.some((item) => !item.rating)) {
    return failed("Select one rating for every official criterion.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_evaluation_form", {
    target_assessment_id: assessmentId,
    evaluation_date: evaluationDate,
    responses,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation(assessmentId);
  return { error: null, success: "Evaluation submitted. HR can now review it." };
}

export async function uploadEvaluationFile(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "supervisor") {
    return failed("Only the assigned supervisor can upload an evaluation file.");
  }
  const assessmentId = uuidField(formData, "assessmentId");
  const file = formData.get("file");
  if (!assessmentId || !(file instanceof File) || file.size === 0) {
    return failed("Choose a PDF, Word document, or image to upload.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = inspectEvaluationFile(file.name, bytes);
  if (!inspected.ok) {
    return failed(inspected.error);
  }
  const supabase = await createSupabaseServerClient();
  const assessment = await supabase
    .from("assessments")
    .select("id, employee_id, workflow_status")
    .eq("id", assessmentId)
    .maybeSingle();
  if (assessment.error || !assessment.data) {
    return failed(assessment.error ? schemaMessage(assessment.error.message) : "Evaluation was not found.");
  }
  const assigned = await supabase
    .from("personnel_assignments")
    .select("employee_id")
    .eq("employee_id", assessment.data.employee_id)
    .eq("supervisor_id", profile.id)
    .maybeSingle();
  if (!assigned.data) {
    return failed("Supervisors can only upload files for assigned personnel.");
  }
  const fileId = randomUUID();
  const storagePath = `evaluations/${assessment.data.employee_id}/${assessment.data.id}/${fileId}`;
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return failed("File upload needs SUPABASE_SERVICE_ROLE_KEY on the server.");
  }
  const uploaded = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: inspected.file.mimeType,
    upsert: false,
  });
  if (uploaded.error) {
    return failed(schemaMessage(uploaded.error.message));
  }
  const registered = await supabase.rpc("register_evaluation_file", {
    target_assessment_id: assessmentId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: inspected.file.mimeType,
    byte_size: bytes.byteLength,
  });
  if (registered.error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return failed(schemaMessage(registered.error.message));
  }
  revalidateEvaluation(assessmentId);
  return { error: null, success: "Evaluation file uploaded to private storage." };
}

export async function createEvaluationFileUrl(fileId: string): Promise<{ error: string | null; url: string | null }> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr" && profile.role !== "supervisor") {
    return { error: "You cannot download evaluation files.", url: null };
  }
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    return { error: "Choose a file.", url: null };
  }
  const supabase = await createSupabaseServerClient();
  const file = await supabase
    .from("evaluation_files")
    .select("storage_path, assessment_id")
    .eq("id", fileId)
    .maybeSingle();
  if (file.error || !file.data) {
    return { error: "That file is outside your access.", url: null };
  }
  if (profile.role === "supervisor") {
    const assessment = await supabase
      .from("assessments")
      .select("employee_id")
      .eq("id", file.data.assessment_id)
      .maybeSingle();
    const assigned = assessment.data
      ? await supabase
          .from("personnel_assignments")
          .select("employee_id")
          .eq("employee_id", assessment.data.employee_id)
          .eq("supervisor_id", profile.id)
          .maybeSingle()
      : { data: null };
    if (!assigned.data) {
      return { error: "Supervisors can only download files for assigned personnel.", url: null };
    }
  }
  try {
    const admin = createSupabaseAdminClient();
    const signed = await admin.storage.from(BUCKET).createSignedUrl(file.data.storage_path, 60);
    if (signed.error || !signed.data?.signedUrl) {
      return { error: "The private file link could not be created.", url: null };
    }
    return { error: null, url: signed.data.signedUrl };
  } catch {
    return { error: "File download needs SUPABASE_SERVICE_ROLE_KEY on the server.", url: null };
  }
}

export async function saveOfficialResult(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can enter the official result.");
  }
  const assessmentId = uuidField(formData, "assessmentId");
  const score = Number(String(formData.get("officialScore") ?? ""));
  if (!assessmentId || !Number.isFinite(score)) {
    return failed("Enter the official score.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_evaluation_result_fields", {
    target_assessment_id: assessmentId,
    official_score: score,
    hr_feedback: String(formData.get("feedback") ?? ""),
    recommendation: String(formData.get("recommendation") ?? ""),
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation(assessmentId);
  return { error: null, success: "Official result saved. It is not released yet." };
}

export async function saveRatingConfiguration(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can configure ratings.");
  }
  const bands = [1, 2, 3, 4, 5].flatMap((index) => {
    const label = String(formData.get(`label${index}`) ?? "").trim();
    const min = String(formData.get(`min${index}`) ?? "").trim();
    const max = String(formData.get(`max${index}`) ?? "").trim();
    if (!label && !min && !max) {
      return [];
    }
    return [{ label, minScore: Number(min), maxScore: Number(max) }];
  });
  const invalid = validateRatingBands(bands);
  if (invalid) {
    return failed(invalid);
  }
  const approveNow = String(formData.get("approve") ?? "") === "yes";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("approve_rating_configuration", {
    bands: bands.map((band) => ({ label: band.label, min: band.minScore, max: band.maxScore })),
    source_note: String(formData.get("sourceNote") ?? ""),
    approve_now: approveNow,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation();
  return {
    error: null,
    success: approveNow
      ? "Rating configuration approved. It is not applied to supervisor criterion selections."
      : "Rating bands saved but not approved. No official rating will be calculated.",
  };
}

export async function releaseEvaluation(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can release an evaluation.");
  }
  const assessmentId = uuidField(formData, "assessmentId");
  if (!assessmentId || String(formData.get("confirmRelease") ?? "") !== "yes") {
    return failed("Confirm the release before completing the evaluation.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("complete_and_release_evaluation", {
    target_assessment_id: assessmentId,
    confirm_release: true,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation(assessmentId);
  return { error: null, success: "Evaluation completed and the result was released." };
}

export async function recalculateRatings(
  previous: EvaluationActionState,
): Promise<EvaluationActionState> {
  void previous;
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can recalculate ratings.");
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("recalculate_released_ratings");
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation();
  return { error: null, success: `Recalculated ${data ?? 0} released rating label(s). Official scores were not changed.` };
}

export async function issueFinalDecision(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can issue the final decision.");
  }
  const employeeId = uuidField(formData, "employeeId");
  const decision = String(formData.get("decision") ?? "");
  if (!employeeId || (decision !== "passed" && decision !== "not_passed")) {
    return failed("Choose Passed or Not Passed.");
  }
  if (String(formData.get("confirmDecision") ?? "") !== "yes") {
    return failed("Confirm the final decision before saving it.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("issue_final_decision", {
    target_employee_id: employeeId,
    decision,
    remark: String(formData.get("remark") ?? ""),
    confirm_decision: true,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation();
  return { error: null, success: "Final decision saved. It is hidden until HR releases it." };
}

export async function releaseFinalDecision(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can release the final decision.");
  }
  const employeeId = uuidField(formData, "employeeId");
  if (!employeeId || String(formData.get("confirmReleaseDecision") ?? "") !== "yes") {
    return failed("Confirm before releasing the final decision.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("release_final_decision", {
    target_employee_id: employeeId,
    confirm_release: true,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation();
  return { error: null, success: "Final decision released to the employee and assigned supervisor." };
}

export async function acknowledgeEvaluation(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "employee") {
    return failed("Only the employee can acknowledge a released evaluation.");
  }
  const assessmentId = uuidField(formData, "assessmentId");
  if (!assessmentId) {
    return failed("Choose an evaluation.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("acknowledge_released_evaluation", {
    target_assessment_id: assessmentId,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation(assessmentId);
  return { error: null, success: "Acknowledgment recorded." };
}

export async function noteEvaluation(
  _previous: EvaluationActionState,
  formData: FormData,
): Promise<EvaluationActionState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "hr") {
    return failed("Only HR can note an evaluation as Human Resource Officer.");
  }
  const assessmentId = uuidField(formData, "assessmentId");
  if (!assessmentId) {
    return failed("Choose an evaluation.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("note_evaluation_as_hro", {
    target_assessment_id: assessmentId,
  });
  if (error) {
    return failed(schemaMessage(error.message));
  }
  revalidateEvaluation(assessmentId);
  return { error: null, success: "Human Resource Officer notation recorded." };
}

function responsesFrom(formData: FormData): { code: string; rating: EvaluationRating | null; comments: string }[] {
  return EVALUATION_CRITERIA.map((criterion) => {
    const rating = String(formData.get(`rating-${criterion.code}`) ?? "");
    return {
      code: criterion.code,
      rating: isRating(rating) ? rating : null,
      comments: String(formData.get(`comments-${criterion.code}`) ?? "").trim(),
    };
  });
}

function isRating(value: string): value is EvaluationRating {
  return value === "exceeds_requirements" || value === "meets_requirements" || value === "does_not_meet_requirements";
}

function uuidField(formData: FormData, name: string): string | null {
  const value = String(formData.get(name) ?? "");
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function dateField(formData: FormData): string {
  const value = String(formData.get("evaluationDate") ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function schemaMessage(message: string): string {
  return /evaluation_|rating_|schema cache|does not exist|Bucket not found/i.test(message)
    ? "Evaluation forms are unavailable until the Phase 6 migration and private evaluation-documents bucket are applied."
    : message;
}

function revalidateEvaluation(assessmentId?: string): void {
  revalidatePath("/dashboard/hr/assessment", "layout");
  revalidatePath("/dashboard/supervisor/assessment", "layout");
  revalidatePath("/dashboard/employee/assessment");
  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/hr");
  if (assessmentId) {
    revalidatePath(`/dashboard/hr/assessment/${assessmentId}`);
    revalidatePath(`/dashboard/supervisor/assessment/${assessmentId}`);
  }
}
