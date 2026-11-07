import "server-only";

import { formatManilaDateTime, manilaDateKey } from "@/lib/attendance/policy";
import { loadAttendanceReport } from "@/lib/attendance/report-data";
import type { WorkflowStatus } from "@/lib/assessment/schedule";
import { requireRole } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXPORT_LIMIT,
  overviewCounts,
  type AttendanceSummary,
  type RankingSettings,
  type ReportAssessment,
  type ReportDecision,
  type ReportEmployee,
  type ReportFilters,
  type ReportPunch,
  type ReportSms,
  type ReportSnapshot,
} from "@/lib/reports/model";

export type ReportOptions = {
  employees: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
  posts: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
  ratings: string[];
};

export type LoadedReport = {
  profileName: string;
  snapshot: ReportSnapshot;
  options: ReportOptions;
};

const emptyAttendance = (): AttendanceSummary => ({
  records: 0,
  presentDays: 0,
  lateRecords: 0,
  potentialAbsences: 0,
  missingTimeIn: 0,
  missingTimeOut: 0,
  latePersonnel: 0,
  officialAbsence: "unavailable",
});

export async function loadReportSnapshot(filters: ReportFilters): Promise<LoadedReport> {
  const profile = await requireRole("hr");
  const supabase = await createSupabaseServerClient();
  const today = manilaDateKey(new Date());
  const warnings: string[] = [];

  const [profiles, assignments, posts, locations, shifts, settings] = await Promise.all([
    supabase.from("profiles").select("id, email, role, first_name, last_name, employee_number, is_active").in("role", ["employee", "supervisor", "hr"]),
    supabase.from("personnel_assignments").select("employee_id, supervisor_id, post_id, duty_location_id, duty_shift_id, start_date"),
    supabase.from("posts").select("id, name"),
    supabase.from("duty_locations").select("id, name"),
    supabase.from("duty_shifts").select("id, name"),
    supabase.from("assessment_settings").select("due_soon_days").eq("id", 1).maybeSingle(),
  ]);
  for (const result of [profiles, assignments, posts, locations, shifts]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }
  if (settings.error && !missingSchema(settings.error.message)) {
    warnings.push(settings.error.message);
  }

  const nameById = new Map(
    (profiles.data ?? []).map((person) => [person.id, [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email]),
  );
  const postById = new Map((posts.data ?? []).map((post) => [post.id, post.name]));
  const locationById = new Map((locations.data ?? []).map((location) => [location.id, location.name]));
  const shiftById = new Map((shifts.data ?? []).map((shift) => [shift.id, shift.name]));
  const assignmentByEmployee = new Map((assignments.data ?? []).map((assignment) => [assignment.employee_id, assignment]));

  const employees: ReportEmployee[] = (profiles.data ?? [])
    .filter((person) => person.role === "employee")
    .map((person) => {
      const assignment = assignmentByEmployee.get(person.id);
      return {
        id: person.id,
        employeeNumber: person.employee_number,
        name: nameById.get(person.id) ?? person.email,
        email: person.email,
        active: person.is_active,
        supervisorId: assignment?.supervisor_id ?? null,
        supervisorName: assignment ? nameById.get(assignment.supervisor_id) ?? "Unavailable" : null,
        postId: assignment?.post_id ?? null,
        postName: assignment ? postById.get(assignment.post_id) ?? "Unavailable" : null,
        locationId: assignment?.duty_location_id ?? null,
        locationName: assignment ? locationById.get(assignment.duty_location_id) ?? "Unavailable" : null,
        shiftId: assignment?.duty_shift_id ?? null,
        shiftName: assignment ? shiftById.get(assignment.duty_shift_id) ?? "Unavailable" : null,
        startDate: assignment?.start_date ?? null,
      };
    });
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  const assessmentsResult = await readPages((from, to) =>
    supabase
      .from("assessments")
      .select("id, employee_id, evaluation_number, due_date, workflow_status")
      .order("due_date")
      .range(from, to),
  );
  if (assessmentsResult.error) {
    warnings.push(missingSchema(assessmentsResult.error) ? "Assessment records are unavailable until the schema is applied." : assessmentsResult.error);
  }
  const assessmentIds = assessmentsResult.rows.map((row) => row.id);
  const [forms, results] = await Promise.all([
    assessmentIds.length
      ? supabase.from("evaluation_forms").select("assessment_id, submitted_at").in("assessment_id", assessmentIds.slice(0, EXPORT_LIMIT))
      : Promise.resolve({ data: [], error: null }),
    assessmentIds.length
      ? supabase.from("evaluation_results").select("assessment_id, official_score, calculated_rating, hr_feedback, released_at, reviewer_id").in("assessment_id", assessmentIds.slice(0, EXPORT_LIMIT))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (forms.error && !missingSchema(forms.error.message)) {
    warnings.push(forms.error.message);
  }
  if (results.error && !missingSchema(results.error.message)) {
    warnings.push(results.error.message);
  }
  const formByAssessment = new Map((forms.data ?? []).map((form) => [form.assessment_id, form]));
  const resultByAssessment = new Map((results.data ?? []).map((result) => [result.assessment_id, result]));
  const assessments: ReportAssessment[] = assessmentsResult.rows.flatMap((row) => {
    if (![1, 2, 3].includes(row.evaluation_number)) {
      return [];
    }
    const employee = employeeById.get(row.employee_id);
    const result = resultByAssessment.get(row.id);
    return [{
      id: row.id,
      employeeId: row.employee_id,
      employeeNumber: employee?.employeeNumber ?? null,
      employeeName: employee?.name ?? nameById.get(row.employee_id) ?? "Employee",
      supervisorId: employee?.supervisorId ?? null,
      supervisorName: employee?.supervisorName ?? null,
      postId: employee?.postId ?? null,
      locationId: employee?.locationId ?? null,
      shiftId: employee?.shiftId ?? null,
      evaluationNumber: row.evaluation_number as 1 | 2 | 3,
      dueDate: row.due_date,
      submittedAt: formByAssessment.get(row.id)?.submitted_at ?? null,
      workflowStatus: row.workflow_status as WorkflowStatus,
      officialScore: result?.official_score ?? null,
      rating: result?.calculated_rating ?? null,
      feedbackRecorded: Boolean(result?.hr_feedback?.trim()),
      released: Boolean(result?.released_at),
    }];
  });

  const decisionsResult = await supabase
    .from("final_decisions")
    .select("employee_id, decision, issued_by, issued_at, released_at");
  if (decisionsResult.error && !missingSchema(decisionsResult.error.message)) {
    warnings.push(decisionsResult.error.message);
  }
  const decisions: ReportDecision[] = (decisionsResult.data ?? []).map((decision) => {
    const employee = employeeById.get(decision.employee_id);
    const own = assessments.filter((item) => item.employeeId === decision.employee_id);
    const third = own.find((item) => item.evaluationNumber === 3);
    const released = own.filter((item) => item.released && item.officialScore != null);
    return {
      employeeId: decision.employee_id,
      employeeNumber: employee?.employeeNumber ?? null,
      employeeName: employee?.name ?? "Employee",
      supervisorId: employee?.supervisorId ?? null,
      supervisorName: employee?.supervisorName ?? null,
      postId: employee?.postId ?? null,
      locationId: employee?.locationId ?? null,
      shiftId: employee?.shiftId ?? null,
      decision: decision.decision,
      issuedAt: decision.issued_at,
      releasedAt: decision.released_at,
      decidedBy: nameById.get(decision.issued_by) ?? null,
      evaluation3Status: third ? third.workflowStatus : "Not scheduled",
      releasedScoreSummary: released.length
        ? released.map((item) => `Evaluation ${item.evaluationNumber}: ${item.officialScore}`).join("; ")
        : "Not released",
    };
  });

  const smsResult = await readPages((from, to) =>
    supabase
      .from("sms_notifications")
      .select("id, created_at, recipient_user_id, recipient_role, employee_id, notification_type, related_record_id, delivery_status, provider_message_id, error_message")
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  if (smsResult.error) {
    warnings.push(missingSchema(smsResult.error) ? "SMS history is unavailable until the Phase 7 migration is applied." : smsResult.error);
  }
  const sms: ReportSms[] = smsResult.rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    recipientName: row.recipient_user_id ? nameById.get(row.recipient_user_id) ?? "Recipient" : "Recipient",
    recipientRole: row.recipient_role,
    recipientPhone: null,
    employeeId: row.employee_id,
    employeeName: row.employee_id ? nameById.get(row.employee_id) ?? "Employee" : "Not linked",
    notificationType: row.notification_type,
    relatedRecordId: row.related_record_id,
    deliveryStatus: row.delivery_status,
    providerMessageId: row.provider_message_id,
    errorMessage: row.error_message,
  }));

  const rankingResult = await supabase
    .from("performance_ranking_settings")
    .select("approved, assessment_weight, attendance_weight, source_note")
    .eq("id", 1)
    .maybeSingle();
  let ranking: RankingSettings | null = null;
  if (rankingResult.error) {
    if (!missingSchema(rankingResult.error.message)) {
      warnings.push(rankingResult.error.message);
    }
  } else if (rankingResult.data) {
    ranking = {
      approved: rankingResult.data.approved,
      assessmentWeight: rankingResult.data.assessment_weight,
      attendanceWeight: rankingResult.data.attendance_weight,
      sourceNote: rankingResult.data.source_note,
    };
  }

  const attendanceWindow = attendanceWindowFor(filters, today);
  const attendanceView = attendanceWindow
    ? await loadAttendanceReport({
        role: "hr",
        viewerId: profile.id,
        params: { period: "custom", from: attendanceWindow.from, to: attendanceWindow.to, category: "expected" },
      })
    : null;
  if (attendanceView && !attendanceView.ready) {
    warnings.push(attendanceView.message ?? "Attendance summary is unavailable.");
  }
  const attendance = attendanceView?.report
    ? {
        records: attendanceView.report.counts.time_in,
        presentDays: attendanceView.report.counts.time_in,
        lateRecords: attendanceView.report.counts.late,
        potentialAbsences: attendanceView.report.counts.potential_absence,
        missingTimeIn: attendanceView.report.counts.missing_time_in,
        missingTimeOut: attendanceView.report.counts.missing_time_out,
        latePersonnel: attendanceView.report.personnel.filter((person) => person.late > 0).length,
        officialAbsence: "unavailable" as const,
      }
    : emptyAttendance();
  const punches = await punchRows(attendanceView?.report ?? null, employeeById);

  if (assessmentsResult.truncated || smsResult.truncated) {
    warnings.push(`Only the first ${EXPORT_LIMIT} rows were loaded. Narrow the filters before exporting.`);
  }

  return {
    profileName: `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
    snapshot: {
      today,
      generatedAt: new Date().toISOString(),
      warning: warnings.filter(Boolean).join(" "),
      employees,
      assessments,
      decisions,
      sms,
      punches,
      attendance,
      ranking,
      dueSoonDays: settings.data?.due_soon_days ?? null,
    },
    options: {
      employees: employees.map((employee) => ({ id: employee.id, name: employee.name })),
      supervisors: (profiles.data ?? [])
        .filter((person) => person.role === "supervisor")
        .map((person) => ({ id: person.id, name: nameById.get(person.id) ?? person.email })),
      posts: (posts.data ?? []).map((post) => ({ id: post.id, name: post.name })),
      locations: (locations.data ?? []).map((location) => ({ id: location.id, name: location.name })),
      shifts: (shifts.data ?? []).map((shift) => ({ id: shift.id, name: shift.name })),
      ratings: [...new Set(assessments.flatMap((item) => (item.released && item.rating ? [item.rating] : [])))],
    },
  };
}

export async function loadHrAnalytics(): Promise<ReturnType<typeof overviewCounts> | null> {
  try {
    const loaded = await loadReportSnapshot({
      report: "overview",
      from: "",
      to: "",
      employeeId: "",
      supervisorId: "",
      postId: "",
      locationId: "",
      shiftId: "",
      status: "",
      rating: "",
      q: "",
      sort: "",
      direction: "asc",
      page: 1,
    });
    return overviewCounts(loaded.snapshot);
  } catch {
    return null;
  }
}

async function punchRows(
  report: Awaited<ReturnType<typeof loadAttendanceReport>>["report"],
  employees: Map<string, ReportEmployee>,
): Promise<ReportPunch[]> {
  if (!report) {
    return [];
  }
  const recordIds = report.lists.time_in.flatMap((row) => (row.recordId ? [row.recordId] : []));
  const verification = new Map<string, { verification: string; timeOut: string; location: string | null }>();
  if (recordIds.length) {
    const supabase = await createSupabaseServerClient();
    const records = await supabase
      .from("attendance_records")
      .select("id, time_out_at, time_in_verification, time_in_location_label")
      .in("id", recordIds.slice(0, EXPORT_LIMIT));
    if (!records.error) {
      for (const record of records.data) {
        verification.set(record.id, {
          verification: record.time_in_verification === "inside_geofence" ? "Inside geofence" : "GPS captured, no geofence",
          timeOut: record.time_out_at ? formatManilaDateTime(record.time_out_at) : "No Time Out",
          location: record.time_in_location_label,
        });
      }
    }
  }
  const lateIds = new Set(report.lists.late.flatMap((row) => (row.recordId ? [row.recordId] : [])));
  const recorded = report.lists.time_in.map((row) => {
    const employee = employees.get(row.employeeId);
    const evidence = row.recordId ? verification.get(row.recordId) : undefined;
    return {
      id: row.recordId ?? row.key,
      employeeId: row.employeeId,
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      supervisorId: employee?.supervisorId ?? null,
      supervisorName: row.supervisorName,
      postId: employee?.postId ?? null,
      postName: row.postName,
      locationId: employee?.locationId ?? null,
      locationName: evidence?.location || employee?.locationName || row.postName,
      shiftId: employee?.shiftId ?? null,
      shiftName: row.shiftName,
      attendanceDate: row.attendanceDate,
      timeIn: row.timeInLabel,
      timeOut: evidence?.timeOut ?? "No Time Out",
      verification: evidence?.verification ?? "Not recorded",
      lateStatus: row.recordId && lateIds.has(row.recordId) ? "Late" : "Not late",
      absenceStatus: "Not an official absence",
    };
  });
  const missing = report.lists.potential_absence.map((row) => {
    const employee = employees.get(row.employeeId);
    return {
      id: row.key,
      employeeId: row.employeeId,
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      supervisorId: employee?.supervisorId ?? null,
      supervisorName: row.supervisorName,
      postId: employee?.postId ?? null,
      postName: row.postName,
      locationId: employee?.locationId ?? null,
      locationName: employee?.locationName ?? null,
      shiftId: employee?.shiftId ?? null,
      shiftName: row.shiftName,
      attendanceDate: row.attendanceDate,
      timeIn: "No Time In",
      timeOut: "No Time Out",
      verification: "No record",
      lateStatus: "Not recorded",
      absenceStatus: "Potential absence",
    };
  });
  return [...recorded, ...missing];
}

function attendanceWindowFor(filters: ReportFilters, today: string): { from: string; to: string } | null {
  if (filters.report === "dtr") {
    if (!filters.from || !filters.to || filters.from > filters.to) {
      return null;
    }
    return { from: filters.from, to: filters.to };
  }
  return { from: `${today.slice(0, 8)}01`, to: today };
}

async function readPages<T extends Record<string, unknown>>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < EXPORT_LIMIT; from += 1000) {
    const result = await fetchPage(from, from + 999);
    if (result.error) {
      return { rows, error: result.error.message, truncated: false };
    }
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 1000) {
      return { rows, error: null, truncated: false };
    }
  }
  return { rows, error: null, truncated: true };
}

function missingSchema(message: string): boolean {
  return /does not exist|schema cache|could not find/i.test(message);
}
