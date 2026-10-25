import "server-only";

import { manilaDateKey } from "@/lib/attendance/policy";
import {
  displayStatus,
  type DisplayStatus,
  type EvaluationNumber,
  type WorkflowStatus,
} from "@/lib/assessment/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AssessmentListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  supervisorName: string | null;
  postName: string | null;
  startDate: string;
  evaluationNumber: EvaluationNumber;
  dueDate: string;
  workflowStatus: WorkflowStatus;
  displayStatus: DisplayStatus;
  latestNote: string | null;
  updatedAt: string;
};

export type AssessmentEventItem = {
  id: string;
  assessmentId: string;
  previousStatus: string | null;
  newStatus: string;
  note: string | null;
  createdAt: string;
};

export type AssessmentBoard = {
  ready: boolean;
  message: string | null;
  settings: {
    evaluation1OffsetDays: number | null;
    evaluation2OffsetDays: number | null;
    evaluation3OffsetDays: number | null;
    dueSoonDays: number | null;
  } | null;
  items: AssessmentListItem[];
  events: AssessmentEventItem[];
  missingSchedules: { id: string; name: string; reason: string }[];
  counts: Record<DisplayStatus, number>;
};

const emptyCounts = (): Record<DisplayStatus, number> => ({
  Upcoming: 0,
  "Due Soon": 0,
  Due: 0,
  Overdue: 0,
  Submitted: 0,
  "Under Review": 0,
  "Returned for Correction": 0,
  Completed: 0,
});

export async function loadAssessmentBoard(input: {
  role: "hr" | "supervisor" | "employee";
  viewerId: string;
  employeeId?: string;
}): Promise<AssessmentBoard> {
  const supabase = await createSupabaseServerClient();
  const settingsResult = await supabase
    .from("assessment_settings")
    .select("evaluation_1_offset_days, evaluation_2_offset_days, evaluation_3_offset_days, due_soon_days")
    .eq("id", 1)
    .maybeSingle();
  if (settingsResult.error) {
    if (/assessment_settings|schema cache|does not exist/i.test(settingsResult.error.message)) {
      return blank("Assessment tracking is unavailable until supabase/schema.sql is applied.");
    }
    return blank(settingsResult.error.message);
  }

  let employeeIds: string[] | null = null;
  if (input.role === "employee") {
    employeeIds = [input.viewerId];
  } else if (input.role === "supervisor") {
    const assigned = await supabase
      .from("personnel_assignments")
      .select("employee_id")
      .eq("supervisor_id", input.viewerId);
    if (assigned.error) {
      return blank(assigned.error.message);
    }
    employeeIds = assigned.data.map((row) => row.employee_id);
    if (input.employeeId && !employeeIds.includes(input.employeeId)) {
      return blank("That assessment schedule is outside your access.");
    }
  }
  if (input.employeeId && input.role !== "supervisor") {
    employeeIds = input.role === "employee" ? [input.viewerId] : [input.employeeId];
  }

  let assessmentQuery = supabase
    .from("assessments")
    .select("id, employee_id, evaluation_number, start_date, due_date, workflow_status, latest_note, updated_at")
    .order("due_date");
  if (employeeIds) {
    assessmentQuery = employeeIds.length
      ? assessmentQuery.in("employee_id", employeeIds)
      : assessmentQuery.eq("employee_id", "00000000-0000-0000-0000-000000000000");
  }
  const assessmentsResult = await assessmentQuery;
  if (assessmentsResult.error) {
    return blank(assessmentsResult.error.message);
  }

  const ids = [...new Set((assessmentsResult.data ?? []).map((row) => row.employee_id))];
  const profilesResult = ids.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, employee_number, is_active, role")
        .in("id", ids)
    : { data: [], error: null };
  const assignmentsResult = ids.length
    ? await supabase
        .from("personnel_assignments")
        .select("employee_id, supervisor_id, post_id, start_date")
        .in("employee_id", ids)
    : { data: [], error: null };
  if (profilesResult.error || assignmentsResult.error) {
    return blank("Unable to load assessment personnel.");
  }

  const supervisorIds = [...new Set((assignmentsResult.data ?? []).map((row) => row.supervisor_id))];
  const postIds = [...new Set((assignmentsResult.data ?? []).map((row) => row.post_id))];
  const [supervisorsResult, postsResult, eventsResult, activeResult] = await Promise.all([
    supervisorIds.length
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", supervisorIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase.from("posts").select("id, name").in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
    (assessmentsResult.data ?? []).length
      ? supabase
          .from("assessment_events")
          .select("id, assessment_id, previous_status, new_status, note, created_at")
          .in("assessment_id", (assessmentsResult.data ?? []).map((row) => row.id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    input.role === "hr"
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("role", "employee")
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (supervisorsResult.error || postsResult.error || eventsResult.error || activeResult.error) {
    return blank("Unable to load assessment details.");
  }

  const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const assignmentById = new Map(
    (assignmentsResult.data ?? []).map((assignment) => [assignment.employee_id, assignment]),
  );
  const supervisorName = new Map(
    (supervisorsResult.data ?? []).map((profile) => [
      profile.id,
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Supervisor",
    ]),
  );
  const postName = new Map((postsResult.data ?? []).map((post) => [post.id, post.name]));
  const today = manilaDateKey(new Date());
  const dueSoonDays = settingsResult.data?.due_soon_days ?? null;
  const counts = emptyCounts();
  const items: AssessmentListItem[] = (assessmentsResult.data ?? []).map((row) => {
    const profile = profileById.get(row.employee_id);
    const assignment = assignmentById.get(row.employee_id);
    const status = displayStatus({
      workflowStatus: row.workflow_status,
      dueDate: row.due_date,
      today,
      dueSoonDays,
    });
    counts[status] += 1;
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeName: profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Employee"
        : "Employee",
      employeeNumber: profile?.employee_number ?? null,
      supervisorName: assignment ? supervisorName.get(assignment.supervisor_id) ?? null : null,
      postName: assignment ? postName.get(assignment.post_id) ?? null : null,
      startDate: row.start_date,
      evaluationNumber: row.evaluation_number as EvaluationNumber,
      dueDate: row.due_date,
      workflowStatus: row.workflow_status,
      displayStatus: status,
      latestNote: row.latest_note,
      updatedAt: row.updated_at,
    };
  });

  const scheduledIds = new Set(items.map((item) => item.employeeId));
  const assignmentStarts = new Map(
    (assignmentsResult.data ?? []).map((assignment) => [assignment.employee_id, assignment.start_date]),
  );
  const missingSchedules =
    input.role === "hr"
      ? await missingForHr(supabase, scheduledIds, activeResult.data ?? [], assignmentStarts)
      : [];

  return {
    ready: true,
    message: settingsResult.data ? null : "HR has not saved assessment intervals yet. No due dates are assumed.",
    settings: settingsResult.data
      ? {
          evaluation1OffsetDays: settingsResult.data.evaluation_1_offset_days,
          evaluation2OffsetDays: settingsResult.data.evaluation_2_offset_days,
          evaluation3OffsetDays: settingsResult.data.evaluation_3_offset_days,
          dueSoonDays: settingsResult.data.due_soon_days,
        }
      : null,
    items,
    events: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      assessmentId: event.assessment_id,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      note: event.note,
      createdAt: event.created_at,
    })),
    missingSchedules,
    counts,
  };
}

async function missingForHr(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  scheduledIds: Set<string>,
  active: { id: string; first_name: string; last_name: string }[],
  knownStarts: Map<string, string>,
): Promise<{ id: string; name: string; reason: string }[]> {
  const missingIds = active.map((employee) => employee.id).filter((id) => !scheduledIds.has(id));
  if (!missingIds.length) {
    return [];
  }
  const assignments = await supabase
    .from("personnel_assignments")
    .select("employee_id, start_date")
    .in("employee_id", missingIds);
  const starts = new Map(knownStarts);
  for (const assignment of assignments.data ?? []) {
    starts.set(assignment.employee_id, assignment.start_date);
  }
  return active
    .filter((employee) => !scheduledIds.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      name: [employee.first_name, employee.last_name].filter(Boolean).join(" ") || "Employee",
      reason: starts.has(employee.id)
        ? "No evaluation rows yet. Synchronize schedules after intervals are saved."
        : "No assignment start date, so a schedule cannot be calculated.",
    }));
}

function blank(message: string): AssessmentBoard {
  return {
    ready: false,
    message,
    settings: null,
    items: [],
    events: [],
    missingSchedules: [],
    counts: emptyCounts(),
  };
}
