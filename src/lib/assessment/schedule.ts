import { addManilaDays } from "../attendance/policy.ts";

export const WORKFLOW_STATUSES = [
  "scheduled",
  "submitted",
  "under_review",
  "returned_for_correction",
  "completed",
] as const;

export const DISPLAY_STATUSES = [
  "Upcoming",
  "Due Soon",
  "Due",
  "Overdue",
  "Submitted",
  "Under Review",
  "Returned for Correction",
  "Completed",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];
export type EvaluationNumber = 1 | 2 | 3;

export type AssessmentSettings = {
  evaluation1OffsetDays: number;
  evaluation2OffsetDays: number;
  evaluation3OffsetDays: number;
  dueSoonDays: number;
};

export type ScheduleRow = {
  employeeId: string;
  evaluationNumber: EvaluationNumber;
  dueDate: string;
  startDate: string;
  workflowStatus: WorkflowStatus;
};

export type SyncPlan = {
  error: string | null;
  inserts: ScheduleRow[];
  dueDateUpdates: ScheduleRow[];
  unchanged: number;
  preservedWorkflow: number;
  missingStart: string[];
};

const MAX_OFFSET_DAYS = 3660;

export function validateAssessmentSettings(input: {
  evaluation1OffsetDays: number | null;
  evaluation2OffsetDays: number | null;
  evaluation3OffsetDays: number | null;
  dueSoonDays: number | null;
}): string | null {
  const values = [
    input.evaluation1OffsetDays,
    input.evaluation2OffsetDays,
    input.evaluation3OffsetDays,
    input.dueSoonDays,
  ];
  if (values.some((value) => value == null || !Number.isInteger(value))) {
    return "Enter whole-day intervals for Evaluation 1, 2, and 3, and a due-soon window. No default interval is applied.";
  }
  const [first, second, third, dueSoon] = values as number[];
  if (first < 1 || second <= first || third <= second) {
    return "Each evaluation must be due more days after the start date than the previous evaluation.";
  }
  if (dueSoon < 0) {
    return "The due-soon window cannot be negative.";
  }
  if ([first, second, third, dueSoon].some((value) => value > MAX_OFFSET_DAYS)) {
    return `Intervals cannot exceed ${MAX_OFFSET_DAYS} days.`;
  }
  return null;
}

export function dueDateFor(
  startDate: string,
  evaluationNumber: EvaluationNumber,
  settings: AssessmentSettings,
): string {
  const offset =
    evaluationNumber === 1
      ? settings.evaluation1OffsetDays
      : evaluationNumber === 2
        ? settings.evaluation2OffsetDays
        : settings.evaluation3OffsetDays;
  return addManilaDays(startDate, offset);
}

export function displayStatus(input: {
  workflowStatus: WorkflowStatus;
  dueDate: string;
  today: string;
  dueSoonDays: number | null;
}): DisplayStatus {
  if (input.workflowStatus === "submitted") {
    return "Submitted";
  }
  if (input.workflowStatus === "under_review") {
    return "Under Review";
  }
  if (input.workflowStatus === "returned_for_correction") {
    return "Returned for Correction";
  }
  if (input.workflowStatus === "completed") {
    return "Completed";
  }
  if (input.dueDate < input.today) {
    return "Overdue";
  }
  if (input.dueDate === input.today) {
    return "Due";
  }
  if (
    input.dueSoonDays != null &&
    input.dueSoonDays >= 0 &&
    input.dueDate <= addManilaDays(input.today, input.dueSoonDays)
  ) {
    return "Due Soon";
  }
  return "Upcoming";
}

export function allowedTransitions(
  status: WorkflowStatus,
  actor: "hr" | "supervisor",
): WorkflowStatus[] {
  if (actor !== "hr" || status === "completed" || status === "scheduled" || status === "returned_for_correction") {
    return [];
  }
  if (status === "submitted") {
    return ["under_review", "returned_for_correction"];
  }
  if (status === "under_review") {
    return ["returned_for_correction"];
  }
  return [];
}

export function planScheduleSync(input: {
  settings: AssessmentSettings | null;
  employees: { id: string; active: boolean; startDate: string | null }[];
  existing: ScheduleRow[];
}): SyncPlan {
  if (!input.settings || validateAssessmentSettings(input.settings)) {
    return {
      error: "HR must save valid assessment intervals before schedules can be generated.",
      inserts: [],
      dueDateUpdates: [],
      unchanged: 0,
      preservedWorkflow: 0,
      missingStart: [],
    };
  }
  const settings = input.settings;
  const existingByKey = new Map(
    input.existing.map((row) => [`${row.employeeId}:${row.evaluationNumber}`, row]),
  );
  const inserts: ScheduleRow[] = [];
  const dueDateUpdates: ScheduleRow[] = [];
  const missingStart: string[] = [];
  let unchanged = 0;
  let preservedWorkflow = 0;

  for (const employee of input.employees) {
    if (!employee.active) {
      continue;
    }
    if (!employee.startDate) {
      missingStart.push(employee.id);
      continue;
    }
    for (const evaluationNumber of [1, 2, 3] as const) {
      const dueDate = dueDateFor(employee.startDate, evaluationNumber, settings);
      const current = existingByKey.get(`${employee.id}:${evaluationNumber}`);
      const next: ScheduleRow = {
        employeeId: employee.id,
        evaluationNumber,
        dueDate,
        startDate: employee.startDate,
        workflowStatus: "scheduled",
      };
      if (!current) {
        inserts.push(next);
        continue;
      }
      if (current.workflowStatus !== "scheduled") {
        preservedWorkflow += 1;
        continue;
      }
      if (current.dueDate !== dueDate || current.startDate !== employee.startDate) {
        dueDateUpdates.push(next);
        continue;
      }
      unchanged += 1;
    }
  }

  return {
    error: null,
    inserts,
    dueDateUpdates,
    unchanged,
    preservedWorkflow,
    missingStart,
  };
}
