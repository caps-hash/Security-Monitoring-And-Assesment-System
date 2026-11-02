import "server-only";

import { EVALUATION_CRITERIA, type EvaluationRating } from "@/lib/assessment/criteria";
import type { EvaluationNumber, WorkflowStatus } from "@/lib/assessment/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EvaluationResponseValue = {
  rating: EvaluationRating | null;
  comments: string;
};

export type EvaluationFileItem = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

export type EvaluationAcknowledgment = {
  kind: "rated_by" | "acknowledge_by" | "noted_by_hro";
  actorName: string;
  acknowledgedAt: string;
};

export type EvaluationDetail = {
  ready: boolean;
  message: string | null;
  assessment: {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeNumber: string | null;
    supervisorName: string;
    positionTitle: string | null;
    departmentSection: string | null;
    evaluationNumber: EvaluationNumber;
    evaluationDate: string | null;
    dueDate: string;
    startDate: string;
    workflowStatus: WorkflowStatus;
    formStatus: "draft" | "submitted" | null;
    submittedAt: string | null;
  } | null;
  responses: Record<string, EvaluationResponseValue>;
  files: EvaluationFileItem[];
  corrections: { remarks: string; createdAt: string }[];
  result: {
    officialScore: number | null;
    calculatedRating: string | null;
    ratingBasis: string;
    feedback: string | null;
    recommendation: string | null;
    releasedAt: string | null;
    reviewerName: string | null;
  } | null;
  acknowledgments: EvaluationAcknowledgment[];
  finalDecision: {
    decision: "passed" | "not_passed";
    remark: string | null;
    issuedAt: string;
    releasedAt: string | null;
  } | null;
};

export type RatingConfigurationView = {
  ready: boolean;
  approved: boolean;
  sourceNote: string | null;
  bands: { label: string; minScore: number; maxScore: number }[];
};

export type ReleasedEvaluation = {
  assessmentId: string;
  evaluationNumber: EvaluationNumber;
  evaluationDate: string | null;
  officialScore: number | null;
  calculatedRating: string | null;
  ratingBasis: string;
  feedback: string | null;
  releasedAt: string;
  acknowledged: boolean;
};

const emptyResponses = (): Record<string, EvaluationResponseValue> =>
  Object.fromEntries(EVALUATION_CRITERIA.map((criterion) => [criterion.code, { rating: null, comments: "" }]));

export async function loadEvaluationDetail(
  assessmentId: string,
  actor: "hr" | "supervisor",
  viewerId: string,
): Promise<EvaluationDetail> {
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) {
    return blank("Choose an evaluation.");
  }
  const supabase = await createSupabaseServerClient();
  const assessment = await supabase
    .from("assessments")
    .select("id, employee_id, evaluation_number, start_date, due_date, workflow_status")
    .eq("id", assessmentId)
    .maybeSingle();
  if (assessment.error) {
    return blank(schemaMessage(assessment.error.message));
  }
  if (!assessment.data) {
    return blank("That evaluation was not found or is outside your access.");
  }
  if (actor === "supervisor") {
    const assigned = await supabase
      .from("personnel_assignments")
      .select("employee_id")
      .eq("employee_id", assessment.data.employee_id)
      .eq("supervisor_id", viewerId)
      .maybeSingle();
    if (assigned.error || !assigned.data) {
      return blank("Supervisors can only open evaluations for assigned personnel.");
    }
  }

  const [profile, assignment, form, files, corrections, result, acknowledgments, decision] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, employee_number")
      .eq("id", assessment.data.employee_id)
      .maybeSingle(),
    supabase
      .from("personnel_assignments")
      .select("supervisor_id, post_id, duty_location_id")
      .eq("employee_id", assessment.data.employee_id)
      .maybeSingle(),
    supabase
      .from("evaluation_forms")
      .select("id, position_title, department_section, evaluation_date, form_status, submitted_at, supervisor_id")
      .eq("assessment_id", assessmentId)
      .maybeSingle(),
    supabase
      .from("evaluation_files")
      .select("id, file_name, mime_type, byte_size, created_at")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("evaluation_corrections")
      .select("remarks, created_at")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("evaluation_results")
      .select("official_score, calculated_rating, rating_basis, hr_feedback, recommendation, released_at, reviewer_id")
      .eq("assessment_id", assessmentId)
      .maybeSingle(),
    supabase
      .from("evaluation_acknowledgments")
      .select("kind, actor_id, acknowledged_at")
      .eq("assessment_id", assessmentId),
    supabase
      .from("final_decisions")
      .select("decision, remark, issued_at, released_at")
      .eq("employee_id", assessment.data.employee_id)
      .maybeSingle(),
  ]);
  if (form.error || files.error || corrections.error || result.error || acknowledgments.error) {
    return blank(schemaMessage(form.error?.message ?? files.error?.message ?? "Evaluation records are unavailable."));
  }

  const responses = emptyResponses();
  if (form.data) {
    const responseRows = await supabase
      .from("evaluation_responses")
      .select("criterion_code, rating, comments")
      .eq("form_id", form.data.id);
    if (responseRows.error) {
      return blank(schemaMessage(responseRows.error.message));
    }
    for (const row of responseRows.data) {
      if (row.criterion_code in responses) {
        responses[row.criterion_code] = {
          rating: isRating(row.rating) ? row.rating : null,
          comments: row.comments ?? "",
        };
      }
    }
  }

  const supervisorId = form.data?.supervisor_id ?? assignment.data?.supervisor_id ?? null;
  const nameIds = [supervisorId, result.data?.reviewer_id, ...(acknowledgments.data ?? []).map((item) => item.actor_id)]
    .filter((id): id is string => Boolean(id));
  const names = nameIds.length
    ? await supabase.from("profiles").select("id, first_name, last_name").in("id", [...new Set(nameIds)])
    : { data: [], error: null };
  const nameById = new Map(
    (names.data ?? []).map((person) => [
      person.id,
      [person.first_name, person.last_name].filter(Boolean).join(" ") || "User",
    ]),
  );
  let positionTitle = form.data?.position_title ?? null;
  let departmentSection = form.data?.department_section ?? null;
  if (!form.data && assignment.data) {
    const [post, location] = await Promise.all([
      supabase.from("posts").select("name").eq("id", assignment.data.post_id).maybeSingle(),
      supabase.from("duty_locations").select("name").eq("id", assignment.data.duty_location_id).maybeSingle(),
    ]);
    positionTitle = post.data?.name ?? null;
    departmentSection = location.data?.name ?? null;
  }

  const released = Boolean(result.data?.released_at);
  const visibleResult = actor === "hr" || released ? result.data : null;
  const visibleDecision = actor === "hr" || decision.data?.released_at ? decision.data : null;

  return {
    ready: true,
    message: null,
    assessment: {
      id: assessment.data.id,
      employeeId: assessment.data.employee_id,
      employeeName: profile.data
        ? [profile.data.first_name, profile.data.last_name].filter(Boolean).join(" ") || "Employee"
        : "Employee",
      employeeNumber: profile.data?.employee_number ?? null,
      supervisorName: supervisorId ? nameById.get(supervisorId) ?? "Assigned supervisor" : "No supervisor",
      positionTitle,
      departmentSection,
      evaluationNumber: assessment.data.evaluation_number as EvaluationNumber,
      evaluationDate: form.data?.evaluation_date ?? null,
      dueDate: assessment.data.due_date,
      startDate: assessment.data.start_date,
      workflowStatus: assessment.data.workflow_status,
      formStatus: form.data?.form_status ?? null,
      submittedAt: form.data?.submitted_at ?? null,
    },
    responses,
    files: (files.data ?? []).map((file) => ({
      id: file.id,
      fileName: file.file_name,
      mimeType: file.mime_type,
      byteSize: file.byte_size,
      createdAt: file.created_at,
    })),
    corrections: (corrections.data ?? []).map((item) => ({
      remarks: item.remarks,
      createdAt: item.created_at,
    })),
    result: visibleResult
      ? {
          officialScore: visibleResult.official_score,
          calculatedRating: visibleResult.calculated_rating,
          ratingBasis: visibleResult.rating_basis,
          feedback: visibleResult.hr_feedback,
          recommendation: visibleResult.recommendation,
          releasedAt: visibleResult.released_at,
          reviewerName: visibleResult.reviewer_id ? nameById.get(visibleResult.reviewer_id) ?? "HR" : null,
        }
      : null,
    acknowledgments: (acknowledgments.data ?? []).map((item) => ({
      kind: item.kind,
      actorName: nameById.get(item.actor_id) ?? "User",
      acknowledgedAt: item.acknowledged_at,
    })),
    finalDecision: visibleDecision
      ? {
          decision: visibleDecision.decision,
          remark: visibleDecision.remark,
          issuedAt: visibleDecision.issued_at,
          releasedAt: visibleDecision.released_at,
        }
      : null,
  };
}

export async function loadRatingConfiguration(): Promise<RatingConfigurationView> {
  const supabase = await createSupabaseServerClient();
  const [config, bands] = await Promise.all([
    supabase.from("rating_configurations").select("approved, source_note").eq("id", 1).maybeSingle(),
    supabase.from("rating_bands").select("label, min_score, max_score, sort_order").order("sort_order"),
  ]);
  if (config.error || bands.error) {
    return { ready: false, approved: false, sourceNote: null, bands: [] };
  }
  return {
    ready: true,
    approved: config.data?.approved ?? false,
    sourceNote: config.data?.source_note ?? null,
    bands: (bands.data ?? []).map((band) => ({
      label: band.label,
      minScore: band.min_score,
      maxScore: band.max_score,
    })),
  };
}

export async function loadReleasedEvaluations(employeeId: string): Promise<{
  ready: boolean;
  message: string | null;
  items: ReleasedEvaluation[];
  finalDecision: EvaluationDetail["finalDecision"];
}> {
  const supabase = await createSupabaseServerClient();
  const assessments = await supabase
    .from("assessments")
    .select("id, evaluation_number")
    .eq("employee_id", employeeId)
    .order("evaluation_number");
  if (assessments.error) {
    return { ready: false, message: schemaMessage(assessments.error.message), items: [], finalDecision: null };
  }
  const ids = (assessments.data ?? []).map((row) => row.id);
  if (!ids.length) {
    return { ready: true, message: null, items: [], finalDecision: null };
  }
  const [results, forms, acknowledgments, decision] = await Promise.all([
    supabase
      .from("evaluation_results")
      .select("assessment_id, official_score, calculated_rating, rating_basis, hr_feedback, released_at")
      .in("assessment_id", ids)
      .not("released_at", "is", null),
    supabase.from("evaluation_forms").select("assessment_id, evaluation_date").in("assessment_id", ids),
    supabase
      .from("evaluation_acknowledgments")
      .select("assessment_id, kind")
      .in("assessment_id", ids)
      .eq("kind", "acknowledge_by"),
    supabase
      .from("final_decisions")
      .select("decision, remark, issued_at, released_at")
      .eq("employee_id", employeeId)
      .not("released_at", "is", null)
      .maybeSingle(),
  ]);
  if (results.error) {
    return { ready: false, message: schemaMessage(results.error.message), items: [], finalDecision: null };
  }
  const formDate = new Map((forms.data ?? []).map((form) => [form.assessment_id, form.evaluation_date]));
  const acknowledged = new Set((acknowledgments.data ?? []).map((item) => item.assessment_id));
  const numberById = new Map((assessments.data ?? []).map((row) => [row.id, row.evaluation_number as EvaluationNumber]));
  return {
    ready: true,
    message: null,
    items: (results.data ?? []).map((result) => ({
      assessmentId: result.assessment_id,
      evaluationNumber: numberById.get(result.assessment_id) ?? 1,
      evaluationDate: formDate.get(result.assessment_id) ?? null,
      officialScore: result.official_score,
      calculatedRating: result.calculated_rating,
      ratingBasis: result.rating_basis,
      feedback: result.hr_feedback,
      releasedAt: result.released_at ?? "",
      acknowledged: acknowledged.has(result.assessment_id),
    })),
    finalDecision: decision.data?.released_at
      ? {
          decision: decision.data.decision,
          remark: decision.data.remark,
          issuedAt: decision.data.issued_at,
          releasedAt: decision.data.released_at,
        }
      : null,
  };
}

function blank(message: string): EvaluationDetail {
  return {
    ready: false,
    message,
    assessment: null,
    responses: emptyResponses(),
    files: [],
    corrections: [],
    result: null,
    acknowledgments: [],
    finalDecision: null,
  };
}

function schemaMessage(message: string): string {
  return /evaluation_|rating_|schema cache|does not exist/i.test(message)
    ? "Evaluation forms are unavailable until supabase/migrations/20261102_phase6_evaluation_forms.sql is applied."
    : message;
}

function isRating(value: string | null): value is EvaluationRating {
  return value === "exceeds_requirements" || value === "meets_requirements" || value === "does_not_meet_requirements";
}
