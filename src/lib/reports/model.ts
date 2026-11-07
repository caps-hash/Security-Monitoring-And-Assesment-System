import { displayStatus, type DisplayStatus, type WorkflowStatus } from "../assessment/schedule.ts";

export const REPORT_IDS = [
  "overview",
  "personnel",
  "dtr",
  "assessment",
  "decision",
  "overdue",
  "supervisor",
  "sms",
  "performers",
] as const;

export const PAGE_SIZE = 25;
export const EXPORT_LIMIT = 5000;

export type ReportId = (typeof REPORT_IDS)[number];

export type ReportFilters = {
  report: ReportId;
  from: string;
  to: string;
  employeeId: string;
  supervisorId: string;
  postId: string;
  locationId: string;
  shiftId: string;
  status: string;
  rating: string;
  q: string;
  sort: string;
  direction: "asc" | "desc";
  page: number;
};

export type ReportColumn = { key: string; label: string };
export type ReportTable = {
  title: string;
  summary: { label: string; value: string }[];
  columns: ReportColumn[];
  rows: Record<string, string>[];
  notes: string[];
  error: string | null;
};

export type RankingSettings = {
  approved: boolean;
  assessmentWeight: number | null;
  attendanceWeight: number | null;
  sourceNote: string | null;
};

export type ReportEmployee = {
  id: string;
  employeeNumber: string | null;
  name: string;
  email: string;
  active: boolean;
  supervisorId: string | null;
  supervisorName: string | null;
  postId: string | null;
  postName: string | null;
  locationId: string | null;
  locationName: string | null;
  shiftId: string | null;
  shiftName: string | null;
  startDate: string | null;
};

export type ReportAssessment = {
  id: string;
  employeeId: string;
  employeeNumber: string | null;
  employeeName: string;
  supervisorId: string | null;
  supervisorName: string | null;
  postId: string | null;
  locationId: string | null;
  shiftId: string | null;
  evaluationNumber: number;
  dueDate: string;
  submittedAt: string | null;
  workflowStatus: WorkflowStatus;
  officialScore: number | null;
  rating: string | null;
  feedbackRecorded: boolean;
  released: boolean;
};

export type ReportDecision = {
  employeeId: string;
  employeeNumber: string | null;
  employeeName: string;
  supervisorId: string | null;
  supervisorName: string | null;
  postId: string | null;
  locationId: string | null;
  shiftId: string | null;
  decision: "passed" | "not_passed";
  issuedAt: string;
  releasedAt: string | null;
  decidedBy: string | null;
  evaluation3Status: string;
  releasedScoreSummary: string;
};

export type ReportSms = {
  id: string;
  createdAt: string;
  recipientName: string;
  recipientRole: string;
  recipientPhone: string | null;
  employeeId: string | null;
  employeeName: string;
  notificationType: string;
  relatedRecordId: string | null;
  deliveryStatus: string;
  providerMessageId: string | null;
  errorMessage: string | null;
};

export type ReportPunch = {
  id: string;
  employeeId: string;
  employeeNumber: string | null;
  employeeName: string;
  supervisorId: string | null;
  supervisorName: string | null;
  postId: string | null;
  postName: string | null;
  locationId: string | null;
  locationName: string | null;
  shiftId: string | null;
  shiftName: string | null;
  attendanceDate: string;
  timeIn: string;
  timeOut: string;
  verification: string;
  lateStatus: string;
  absenceStatus: string;
};

export type AttendanceSummary = {
  records: number;
  presentDays: number;
  lateRecords: number;
  potentialAbsences: number;
  missingTimeIn: number;
  missingTimeOut: number;
  latePersonnel: number;
  officialAbsence: "unavailable";
};

export type ReportSnapshot = {
  today: string;
  generatedAt: string;
  warning: string | null;
  employees: ReportEmployee[];
  assessments: ReportAssessment[];
  decisions: ReportDecision[];
  sms: ReportSms[];
  punches: ReportPunch[];
  attendance: AttendanceSummary;
  ranking: RankingSettings | null;
  dueSoonDays: number | null;
};

const REPORT_TITLES: Record<ReportId, string> = {
  overview: "Analytics overview",
  personnel: "Personnel report",
  dtr: "DTR report",
  assessment: "Assessment report",
  decision: "Passed / Not Passed report",
  overdue: "Overdue assessment report",
  supervisor: "Supervisor activity report",
  sms: "SMS notification report",
  performers: "Top performers",
};

export function isReportId(value: string): value is ReportId {
  return REPORT_IDS.some((report) => report === value);
}

export function reportTitle(report: ReportId): string {
  return REPORT_TITLES[report];
}

export function relevantFilters(report: ReportId): Array<keyof ReportFilters> {
  if (report === "overview") {
    return [];
  }
  if (report === "sms") {
    return ["from", "to", "employeeId", "status", "q"];
  }
  if (report === "supervisor") {
    return ["from", "to", "supervisorId", "q"];
  }
  if (report === "decision") {
    return ["from", "to", "employeeId", "supervisorId", "status", "q"];
  }
  if (report === "dtr") {
    return ["from", "to", "employeeId", "supervisorId", "postId", "locationId", "shiftId", "status", "q"];
  }
  return ["from", "to", "employeeId", "supervisorId", "postId", "locationId", "shiftId", "status", "rating", "q"];
}

export function readReportFilters(
  params: Record<string, string | string[] | undefined>,
  today: string,
): ReportFilters {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const reportValue = first(params.report);
  const report = isReportId(reportValue) ? reportValue : "overview";
  const page = Number(first(params.page));
  const direction = first(params.direction) === "desc" ? "desc" : "asc";
  const from = dateOrBlank(first(params.from));
  const to = dateOrBlank(first(params.to));
  return {
    report,
    from: report === "dtr" && !from && !to ? monthStart(today) : from,
    to: report === "dtr" && !from && !to ? today : to,
    employeeId: first(params.employee),
    supervisorId: first(params.supervisor),
    postId: first(params.post),
    locationId: first(params.location),
    shiftId: first(params.shift),
    status: first(params.status),
    rating: first(params.rating),
    q: first(params.q).slice(0, 80),
    sort: first(params.sort).slice(0, 40),
    direction,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function validateReportFilters(filters: ReportFilters): string | null {
  if (filters.from && filters.to && filters.from > filters.to) {
    return "The start date cannot be after the end date.";
  }
  if (filters.report === "dtr" && filters.from && filters.to) {
    const days = daysBetween(filters.from, filters.to) + 1;
    if (days > 92) {
      return "The DTR report is limited to 92 days, matching the existing attendance summary.";
    }
  }
  return null;
}

export function buildReport(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const invalid = validateReportFilters(filters);
  if (invalid) {
    return emptyTable(reportTitle(filters.report), invalid);
  }
  switch (filters.report) {
    case "overview":
      return overviewTable(snapshot);
    case "personnel":
      return personnelTable(snapshot, filters);
    case "dtr":
      return dtrTable(snapshot, filters);
    case "assessment":
      return assessmentTable(snapshot, filters);
    case "decision":
      return decisionTable(snapshot, filters);
    case "overdue":
      return overdueTable(snapshot, filters);
    case "supervisor":
      return supervisorTable(snapshot, filters);
    case "sms":
      return smsTable(snapshot, filters);
    case "performers":
      return performersTable(snapshot, filters);
    default:
      return emptyTable("Report", "Choose a report.");
  }
}

export function overviewCounts(snapshot: ReportSnapshot) {
  const employees = snapshot.employees;
  const active = employees.filter((employee) => employee.active);
  const assessments = snapshot.assessments.map((item) => ({
    ...item,
    display: assessmentDisplay(item, snapshot),
  }));
  const releasedDecisions = snapshot.decisions.filter((item) => item.releasedAt);
  return {
    totalEmployees: employees.length,
    activeEmployees: active.length,
    upcoming: assessments.filter((item) => item.display === "Upcoming").length,
    dueSoon: assessments.filter((item) => item.display === "Due Soon" || item.display === "Due").length,
    overdue: assessments.filter((item) => item.display === "Overdue").length,
    completed: assessments.filter((item) => item.display === "Completed").length,
    passed: new Set(releasedDecisions.filter((item) => item.decision === "passed").map((item) => item.employeeId)).size,
    notPassed: new Set(releasedDecisions.filter((item) => item.decision === "not_passed").map((item) => item.employeeId)).size,
    latePersonnel: snapshot.attendance.latePersonnel,
    potentialAbsences: snapshot.attendance.potentialAbsences,
  };
}

export function validateRankingWeights(input: {
  assessmentWeight: number | null;
  attendanceWeight: number | null;
  sourceNote: string;
  approve: boolean;
}): string | null {
  const assessment = input.assessmentWeight;
  const attendance = input.attendanceWeight;
  if (assessment == null || attendance == null || !Number.isInteger(assessment) || !Number.isInteger(attendance)) {
    return "Enter whole-number assessment and attendance weights. No ranking formula is assumed.";
  }
  if (assessment < 0 || attendance < 0 || assessment + attendance !== 100) {
    return "Assessment and attendance weights must total 100%.";
  }
  if (input.approve && input.sourceNote.trim().length < 8) {
    return "Enter an approval note of at least 8 characters before using a combined ranking.";
  }
  return null;
}

export function rankingScore(input: {
  settings: RankingSettings | null;
  assessmentScore: number | null;
  attendancePercent: number | null;
}): { overall: number | null; reason: string } {
  if (!input.settings?.approved || input.settings.assessmentWeight == null || input.settings.attendanceWeight == null) {
    return { overall: null, reason: "Combined ranking is not configured." };
  }
  if (input.settings.assessmentWeight + input.settings.attendanceWeight !== 100) {
    return { overall: null, reason: "The saved weights do not total 100%." };
  }
  if (input.assessmentScore == null || input.attendancePercent == null) {
    return { overall: null, reason: "Incomplete assessment or attendance data is not treated as zero." };
  }
  const overall =
    (input.settings.assessmentWeight * input.assessmentScore + input.settings.attendanceWeight * input.attendancePercent) / 100;
  return {
    overall: Math.round(overall * 100) / 100,
    reason: "Calculated only from released official scores and scheduled attendance completion.",
  };
}

export function toCsv(table: ReportTable): string {
  const lines = [
    csvRow([table.title]),
    csvRow(table.summary.flatMap((item) => [item.label, item.value])),
    csvRow(table.columns.map((column) => column.label)),
    ...table.rows.map((row) => csvRow(table.columns.map((column) => row[column.key] ?? ""))),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function toExcelXml(table: ReportTable): string {
  const header = table.columns.map((column) => `<Cell><Data ss:Type="String">${xmlEscape(column.label)}</Data></Cell>`).join("");
  const rows = table.rows
    .map((row) => `<Row>${table.columns.map((column) => `<Cell><Data ss:Type="String">${xmlEscape(row[column.key] ?? "")}</Data></Cell>`).join("")}</Row>`)
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xmlEscape(table.title.slice(0, 31) || "Report")}"><Table><Row>${header}</Row>${rows}</Table></Worksheet>
</Workbook>`;
}

export function toPdf(table: ReportTable): Uint8Array {
  const lines = [
    table.title,
    ...table.summary.map((item) => `${item.label}: ${item.value}`),
    ...table.notes,
    table.columns.map((column) => column.label).join(" | "),
    ...table.rows.map((row) => table.columns.map((column) => row[column.key] ?? "").join(" | ")),
  ].flatMap((line) => wrapPdfLine(line));
  return pdfFromLines(lines.length ? lines : ["No rows"]);
}

export function paginateRows<T>(rows: T[], page: number, pageSize = PAGE_SIZE): { page: number; pages: number; rows: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(page, 1), pages);
  return { page: current, pages, rows: rows.slice((current - 1) * pageSize, current * pageSize) };
}

function overviewTable(snapshot: ReportSnapshot): ReportTable {
  const counts = overviewCounts(snapshot);
  return {
    title: reportTitle("overview"),
    summary: [
      { label: "Total employees", value: String(counts.totalEmployees) },
      { label: "Active employees", value: String(counts.activeEmployees) },
      { label: "Upcoming assessments", value: String(counts.upcoming) },
      { label: "Due or due soon", value: String(counts.dueSoon) },
      { label: "Overdue assessments", value: String(counts.overdue) },
      { label: "Completed assessments", value: String(counts.completed) },
      { label: "Passed", value: String(counts.passed) },
      { label: "Not passed", value: String(counts.notPassed) },
      { label: "Late personnel", value: String(counts.latePersonnel) },
      { label: "Potential absences", value: String(counts.potentialAbsences) },
    ],
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ],
    rows: [
      ["Total employees", counts.totalEmployees],
      ["Active employees", counts.activeEmployees],
      ["Upcoming assessments", counts.upcoming],
      ["Due or due soon", counts.dueSoon],
      ["Overdue assessments", counts.overdue],
      ["Completed assessments", counts.completed],
      ["Passed", counts.passed],
      ["Not passed", counts.notPassed],
      ["Late personnel", counts.latePersonnel],
      ["Potential absences", counts.potentialAbsences],
    ].map(([metric, value]) => ({ metric: String(metric), value: String(value) })),
    notes: [
      "Passed and Not Passed count released HR decisions only. An incomplete evaluation is not Not Passed.",
      "Potential absences follow the existing attendance summary. There is no official absence ruling.",
      snapshot.warning ?? "",
    ].filter(Boolean),
    error: null,
  };
}

function personnelTable(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const rows = sortRows(
    snapshot.employees.filter((employee) => matchesEmployee(employee, filters) && inDate(employee.startDate, filters)).map((employee) => ({
      employeeNumber: employee.employeeNumber ?? "Not assigned",
      name: employee.name,
      email: employee.email,
      status: employee.active ? "Active" : "Inactive",
      supervisor: employee.supervisorName ?? "Not assigned",
      post: employee.postName ?? "Not assigned",
      location: employee.locationName ?? "Not assigned",
      shift: employee.shiftName ?? "Not assigned",
      startDate: employee.startDate ?? "Not assigned",
    })),
    filters,
  );
  return table("personnel", rows, [
    ["employeeNumber", "Employee ID"],
    ["name", "Employee name"],
    ["email", "Email"],
    ["status", "Account status"],
    ["supervisor", "Supervisor"],
    ["post", "Assigned post"],
    ["location", "Duty location"],
    ["shift", "Duty shift"],
    ["startDate", "Start date"],
  ], [
    { label: "Employees", value: String(rows.length) },
  ], ["Authentication secrets are not included."]);
}

function dtrTable(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const rows = sortRows(
    snapshot.punches.filter((punch) => matchesAssignment(punch, filters) && inDate(punch.attendanceDate, filters) && includesText(punch, filters.q)).map((punch) => ({
      employeeNumber: punch.employeeNumber ?? "Not assigned",
      name: punch.employeeName,
      date: punch.attendanceDate,
      timeIn: punch.timeIn,
      timeOut: punch.timeOut,
      location: punch.locationName ?? "Not recorded",
      verification: punch.verification,
      lateStatus: punch.lateStatus,
      absenceStatus: punch.absenceStatus,
    })),
    filters,
  );
  const recorded = rows.filter((row) => row.timeIn !== "No Time In");
  return table("dtr", rows, [
    ["employeeNumber", "Employee ID"],
    ["name", "Employee name"],
    ["date", "Date"],
    ["timeIn", "Time In"],
    ["timeOut", "Time Out"],
    ["location", "Attendance location"],
    ["verification", "Verification status"],
    ["lateStatus", "Late status"],
    ["absenceStatus", "Absence status"],
  ], [
    { label: "Attendance records", value: String(recorded.length) },
    { label: "Present days", value: String(recorded.length) },
    { label: "Late records", value: String(rows.filter((row) => row.lateStatus === "Late").length) },
    { label: "Potential absences", value: String(rows.filter((row) => row.absenceStatus === "Potential absence").length) },
    { label: "Missing Time In", value: String(rows.filter((row) => row.timeIn === "No Time In").length) },
    { label: "Missing Time Out", value: String(rows.filter((row) => row.timeOut === "No Time Out" && row.absenceStatus !== "Potential absence").length) },
  ], ["Official absence is unavailable. A scheduled day without Time In is a potential absence only. Counts follow the filtered rows and the existing attendance summary rules."]);
}

function assessmentTable(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const rows = sortRows(
    snapshot.assessments.filter((item) => matchesAssessment(item, snapshot, filters)).map((item) => ({
      employeeNumber: item.employeeNumber ?? "Not assigned",
      name: item.employeeName,
      supervisor: item.supervisorName ?? "Not assigned",
      evaluation: String(item.evaluationNumber),
      dueDate: item.dueDate,
      submittedAt: item.submittedAt ? item.submittedAt.slice(0, 10) : "Not submitted",
      status: assessmentDisplay(item, snapshot),
      score: item.released && item.officialScore != null ? String(item.officialScore) : "Not released",
      rating: item.released && item.rating ? item.rating : "Not released",
      feedback: item.feedbackRecorded ? "Recorded" : "Not recorded",
    })),
    filters,
  );
  return table("assessment", rows, [
    ["employeeNumber", "Employee ID"],
    ["name", "Employee name"],
    ["supervisor", "Supervisor"],
    ["evaluation", "Evaluation number"],
    ["dueDate", "Due date"],
    ["submittedAt", "Submission date"],
    ["status", "Assessment status"],
    ["score", "Official score"],
    ["rating", "Rating"],
    ["feedback", "HR feedback status"],
  ], [{ label: "Evaluations", value: String(rows.length) }], ["Unreleased scores and ratings are not shown."]);
}

function decisionTable(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const rows = sortRows(
    snapshot.decisions.filter((item) => item.releasedAt && matchesDecision(item, filters)).map((item) => ({
      employeeNumber: item.employeeNumber ?? "Not assigned",
      name: item.employeeName,
      supervisor: item.supervisorName ?? "Not assigned",
      evaluationStatus: item.evaluation3Status,
      scoreSummary: item.releasedScoreSummary,
      decision: item.decision === "passed" ? "PASSED" : "NOT PASSED",
      decisionDate: item.releasedAt?.slice(0, 10) ?? "",
      decidedBy: item.decidedBy ?? "Not recorded",
    })),
    filters,
  );
  return table("decision", rows, [
    ["employeeNumber", "Employee ID"],
    ["name", "Employee name"],
    ["supervisor", "Supervisor"],
    ["evaluationStatus", "Final evaluation status"],
    ["scoreSummary", "Released score summary"],
    ["decision", "Final decision"],
    ["decisionDate", "Decision date"],
    ["decidedBy", "HR decision-maker"],
  ], [
    { label: "Passed", value: String(rows.filter((row) => row.decision === "PASSED").length) },
    { label: "Not passed", value: String(rows.filter((row) => row.decision === "NOT PASSED").length) },
  ], ["Unreleased decisions and incomplete evaluations are excluded."]);
}

function overdueTable(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const rows = sortRows(
    snapshot.assessments.filter((item) => assessmentDisplay(item, snapshot) === "Overdue" && matchesAssessment(item, snapshot, filters)).map((item) => ({
      employeeNumber: item.employeeNumber ?? "Not assigned",
      name: item.employeeName,
      supervisor: item.supervisorName ?? "Not assigned",
      evaluation: String(item.evaluationNumber),
      dueDate: item.dueDate,
      daysOverdue: String(Math.max(daysBetween(item.dueDate, snapshot.today), 0)),
      status: "Overdue",
    })),
    filters,
  );
  return table("overdue", rows, [
    ["employeeNumber", "Employee ID"],
    ["name", "Employee name"],
    ["supervisor", "Supervisor"],
    ["evaluation", "Evaluation number"],
    ["dueDate", "Due date"],
    ["daysOverdue", "Days overdue"],
    ["status", "Current assessment status"],
  ], [{ label: "Overdue evaluations", value: String(rows.length) }], ["Completed, submitted, and under-review evaluations are excluded by the Phase 5 status rules."]);
}

function supervisorTable(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const supervisors = new Map<string, { id: string; name: string }>();
  for (const employee of snapshot.employees) {
    if (employee.supervisorId) {
      supervisors.set(employee.supervisorId, { id: employee.supervisorId, name: employee.supervisorName ?? "Supervisor" });
    }
  }
  const rows = sortRows(
    [...supervisors.values()].filter((supervisor) => !filters.supervisorId || supervisor.id === filters.supervisorId).map((supervisor) => {
      const assigned = snapshot.employees.filter((employee) => employee.supervisorId === supervisor.id);
      const evaluations = snapshot.assessments.filter((item) => item.supervisorId === supervisor.id && inDate(item.dueDate, filters));
      const submitted = evaluations.filter((item) => item.workflowStatus !== "scheduled");
      const onTime = submitted.filter((item) => item.submittedAt && item.submittedAt.slice(0, 10) <= item.dueDate);
      const timeliness = submitted.length && submitted.every((item) => item.submittedAt)
        ? `${onTime.length} of ${submitted.length} submitted on or before the due date`
        : "Not available";
      return {
        name: supervisor.name,
        assigned: String(assigned.length),
        evaluations: String(evaluations.length),
        submitted: String(submitted.length),
        completed: String(evaluations.filter((item) => item.workflowStatus === "completed").length),
        overdue: String(evaluations.filter((item) => assessmentDisplay(item, snapshot) === "Overdue").length),
        returned: String(evaluations.filter((item) => item.workflowStatus === "returned_for_correction").length),
        timeliness,
      };
    }).filter((row) => includesText(row, filters.q)),
    filters,
  );
  return table("supervisor", rows, [
    ["name", "Supervisor name"],
    ["assigned", "Assigned employees"],
    ["evaluations", "Evaluations assigned"],
    ["submitted", "Evaluations submitted"],
    ["completed", "Completed evaluations"],
    ["overdue", "Overdue evaluations"],
    ["returned", "Returned evaluations"],
    ["timeliness", "Submission timeliness"],
  ], [{ label: "Supervisors", value: String(rows.length) }], ["These are activity counts, not formal supervisor performance ratings."]);
}

function smsTable(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const rows = sortRows(
    snapshot.sms.filter((item) => {
      const date = item.createdAt.slice(0, 10);
      return inDate(date, filters)
        && (!filters.employeeId || item.employeeId === filters.employeeId)
        && (!filters.status || item.deliveryStatus === filters.status)
        && includesText(item, filters.q);
    }).map((item) => ({
      recipient: item.recipientName,
      employee: item.employeeName,
      role: item.recipientRole,
      type: item.notificationType,
      related: item.relatedRecordId ?? "Not linked",
      sentAt: item.createdAt,
      status: item.deliveryStatus,
      providerId: item.providerMessageId ?? "Not assigned",
      error: item.errorMessage ?? "None",
    })),
    filters,
  );
  return table("sms", rows, [
    ["recipient", "Recipient"],
    ["employee", "Employee"],
    ["role", "Recipient role"],
    ["type", "Notification type"],
    ["related", "Related record"],
    ["sentAt", "Date and time"],
    ["status", "Delivery status"],
    ["providerId", "Provider message ID"],
    ["error", "Error details"],
  ], [
    { label: "Attempted", value: String(rows.length) },
    { label: "Accepted or delivered", value: String(rows.filter((row) => row.status === "sent" || row.status === "delivered").length) },
    { label: "Failed or rejected", value: String(rows.filter((row) => row.status === "failed" || row.status === "rejected").length) },
    { label: "Pending", value: String(rows.filter((row) => row.status === "pending" || row.status === "processing").length) },
  ], ["Opening this report does not send SMS. Provider credentials are not included."]);
}

function performersTable(snapshot: ReportSnapshot, filters: ReportFilters): ReportTable {
  const configured = Boolean(snapshot.ranking?.approved);
  const metrics = snapshot.employees.filter((employee) => employee.active && matchesEmployee(employee, filters)).map((employee) => {
    const scores = snapshot.assessments
      .filter((item) => item.employeeId === employee.id && item.released && item.officialScore != null && inDate(item.dueDate, filters))
      .map((item) => item.officialScore as number);
    const assessmentScore = scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100 : null;
    const attendance = attendancePercent(snapshot, employee.id);
    const ranked = rankingScore({
      settings: snapshot.ranking,
      assessmentScore,
      attendancePercent: attendance,
    });
    return {
      employee,
      assessmentScore,
      attendance,
      overall: ranked.overall,
    };
  });
  const rankedRows = metrics
    .filter((item) => item.overall != null)
    .sort((left, right) => (right.overall ?? 0) - (left.overall ?? 0) || left.employee.name.localeCompare(right.employee.name));
  const rankById = new Map(rankedRows.map((item, index) => [item.employee.id, String(index + 1)]));
  const rows = metrics.filter((item) => includesText(item.employee, filters.q)).map((item) => ({
    rank: rankById.get(item.employee.id) ?? "Not ranked",
    employeeNumber: item.employee.employeeNumber ?? "Not assigned",
    name: item.employee.name,
    assessment: item.assessmentScore == null ? "Incomplete" : String(item.assessmentScore),
    attendance: item.attendance == null ? "Incomplete" : `${item.attendance}%`,
    overall: item.overall == null ? "Not configured" : String(item.overall),
    period: filters.from && filters.to ? `${filters.from} to ${filters.to}` : "All available released results",
  }));
  return table("performers", rows, [
    ["rank", "Rank"],
    ["employeeNumber", "Employee ID"],
    ["name", "Employee name"],
    ["assessment", "Assessment performance"],
    ["attendance", "Attendance performance"],
    ["overall", "Overall performance"],
    ["period", "Reporting period"],
  ], [{ label: "Combined ranking", value: configured ? "Configured" : "Not configured" }], [
    configured
      ? `Approved weights: assessment ${snapshot.ranking?.assessmentWeight}% and attendance ${snapshot.ranking?.attendanceWeight}%. Missing data is not treated as zero. This is not an employment decision.`
      : "No approved ranking formula is saved. Assessment and attendance metrics are shown separately.",
  ]);
}

function attendancePercent(snapshot: ReportSnapshot, employeeId: string): number | null {
  const expected = snapshot.punches.filter((punch) => punch.employeeId === employeeId && (punch.timeIn !== "No Time In" || punch.absenceStatus === "Potential absence"));
  if (!expected.length) {
    return null;
  }
  const present = expected.filter((punch) => punch.timeIn !== "No Time In" && punch.absenceStatus !== "Potential absence");
  return Math.round((present.length / expected.length) * 1000) / 10;
}

function assessmentDisplay(item: ReportAssessment, snapshot: ReportSnapshot): DisplayStatus {
  return displayStatus({
    workflowStatus: item.workflowStatus,
    dueDate: item.dueDate,
    today: snapshot.today,
    dueSoonDays: snapshot.dueSoonDays,
  });
}

function matchesAssessment(item: ReportAssessment, snapshot: ReportSnapshot, filters: ReportFilters): boolean {
  const display = assessmentDisplay(item, snapshot);
  return (!filters.employeeId || item.employeeId === filters.employeeId)
    && (!filters.supervisorId || item.supervisorId === filters.supervisorId)
    && (!filters.postId || item.postId === filters.postId)
    && (!filters.locationId || item.locationId === filters.locationId)
    && (!filters.shiftId || item.shiftId === filters.shiftId)
    && (!filters.status || display === filters.status || item.workflowStatus === filters.status)
    && (!filters.rating || item.rating === filters.rating)
    && inDate(item.dueDate, filters)
    && includesText(item, filters.q);
}

function matchesEmployee(employee: ReportEmployee, filters: ReportFilters): boolean {
  return (!filters.employeeId || employee.id === filters.employeeId)
    && (!filters.supervisorId || employee.supervisorId === filters.supervisorId)
    && (!filters.postId || employee.postId === filters.postId)
    && (!filters.locationId || employee.locationId === filters.locationId)
    && (!filters.shiftId || employee.shiftId === filters.shiftId)
    && (!filters.status || (filters.status === "active" ? employee.active : filters.status === "inactive" ? !employee.active : true))
    && includesText(employee, filters.q);
}

function matchesAssignment(row: ReportPunch, filters: ReportFilters): boolean {
  return (!filters.employeeId || row.employeeId === filters.employeeId)
    && (!filters.supervisorId || row.supervisorId === filters.supervisorId)
    && (!filters.postId || row.postId === filters.postId)
    && (!filters.locationId || row.locationId === filters.locationId)
    && (!filters.shiftId || row.shiftId === filters.shiftId)
    && (!filters.status || row.lateStatus === filters.status || row.absenceStatus === filters.status || row.verification === filters.status);
}

function matchesDecision(item: ReportDecision, filters: ReportFilters): boolean {
  const label = item.decision === "passed" ? "PASSED" : "NOT PASSED";
  return (!filters.employeeId || item.employeeId === filters.employeeId)
    && (!filters.supervisorId || item.supervisorId === filters.supervisorId)
    && (!filters.status || item.decision === filters.status || label === filters.status)
    && inDate(item.releasedAt?.slice(0, 10) ?? null, filters)
    && includesText(item, filters.q);
}

function inDate(value: string | null, filters: ReportFilters): boolean {
  if (!filters.from && !filters.to) {
    return true;
  }
  if (!value) {
    return false;
  }
  if (filters.from && value < filters.from) {
    return false;
  }
  if (filters.to && value > filters.to) {
    return false;
  }
  return true;
}

function includesText(value: object, query: string): boolean {
  if (!query) {
    return true;
  }
  return JSON.stringify(value).toLowerCase().includes(query.toLowerCase());
}

function sortRows(rows: Record<string, string>[], filters: ReportFilters): Record<string, string>[] {
  if (!filters.sort) {
    return rows;
  }
  const direction = filters.direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => (left[filters.sort] ?? "").localeCompare(right[filters.sort] ?? "", undefined, { numeric: true }) * direction);
}

function table(
  report: ReportId,
  rows: Record<string, string>[],
  columns: Array<[string, string]>,
  summary: { label: string; value: string }[],
  notes: string[],
): ReportTable {
  return {
    title: reportTitle(report),
    summary,
    columns: columns.map(([key, label]) => ({ key, label })),
    rows,
    notes,
    error: null,
  };
}

function emptyTable(title: string, error: string): ReportTable {
  return { title, summary: [], columns: [], rows: [], notes: [], error };
}

function dateOrBlank(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function monthStart(today: string): string {
  return `${today.slice(0, 8)}01`;
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function csvRow(values: string[]): string {
  return values.map((value) => `"${value.replace(/"/g, '""')}"`).join(",");
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapPdfLine(value: string): string[] {
  const clean = value.replace(/[^\x20-\x7E]/g, " ");
  const lines: string[] = [];
  for (let index = 0; index < clean.length; index += 110) {
    lines.push(clean.slice(index, index + 110));
  }
  return lines.length ? lines : [""];
}

function pdfFromLines(lines: string[]): Uint8Array {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 46) {
    pages.push(lines.slice(index, index + 46));
  }
  const objects: string[] = [];
  const pageIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  pages.forEach((page, pageIndex) => {
    const contentId = 4 + pageIndex * 2;
    pageIds.push(contentId - 1);
    const commands = ["BT", "/F1 9 Tf", "36 560 Td", "14 TL"];
    page.forEach((line, lineIndex) => {
      commands.push(`(${pdfEscape(line)}) Tj`);
      if (lineIndex < page.length - 1) {
        commands.push("T*");
      }
    });
    commands.push("ET");
    const stream = commands.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
