import {
  addManilaDays,
  formatManilaDateTime,
  lateMinutes,
  manilaDateKey,
  shiftEndPassed,
  shiftNote,
  type ShiftNote,
} from "./policy.ts";

export const REPORT_RANGE_LIMIT_DAYS = 92;

export const SUMMARY_CATEGORIES = [
  "expected",
  "time_in",
  "time_out",
  "late",
  "missing_time_in",
  "missing_time_out",
  "no_record",
  "potential_absence",
  "in_progress",
  "review",
  "repeated",
  "unconfigured",
] as const;

export type SummaryCategory = (typeof SUMMARY_CATEGORIES)[number];
export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";

export type ReportPerson = {
  id: string;
  name: string;
  employeeNumber: string | null;
  active: boolean;
  supervisorId: string | null;
  supervisorName: string | null;
  postName: string | null;
  locationId: string | null;
  locationName: string | null;
  shiftName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  startDate: string | null;
  scheduledWeekdays: number[] | null;
};

export type ReportPunch = {
  id: string;
  employeeId: string;
  attendanceDate: string;
  timeInAt: string;
  timeOutAt: string | null;
  status: "open" | "completed";
  storedShiftNote: ShiftNote | null;
  shiftStart: string;
  shiftEnd: string;
  postName: string;
  locationName: string;
  shiftName: string;
  locationId: string;
};

export type NamedRow = {
  key: string;
  recordId: string | null;
  employeeId: string;
  employeeNumber: string | null;
  employeeName: string;
  supervisorName: string | null;
  postName: string | null;
  shiftName: string | null;
  shiftStart: string | null;
  attendanceDate: string;
  timeInLabel: string;
  minutesLate: number | null;
  statusLabel: string;
  detail: string;
};

export type DayBreakdown = {
  date: string;
  expected: number;
  timeIn: number;
  timeOut: number;
  late: number;
  missingTimeIn: number;
  missingTimeOut: number;
};

export type PersonBreakdown = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  expected: number;
  recorded: number;
  late: number;
  missingTimeIn: number;
  missingTimeOut: number;
};

export type AttendanceReport = {
  period: ReportPeriod;
  from: string;
  to: string;
  anchor: string;
  category: SummaryCategory;
  completionRate: number | null;
  completionDenominator: string;
  officialAbsence: "unavailable";
  limitations: string[];
  daysWithoutScheduledAttendance: string[];
  counts: Record<SummaryCategory, number>;
  lists: Record<SummaryCategory, NamedRow[]>;
  daily: DayBreakdown[];
  personnel: PersonBreakdown[];
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function manilaWeekday(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00+08:00`));
  return WEEKDAY_INDEX[label] ?? null;
}

export function calendarWeek(anchor: string): { from: string; to: string } {
  const weekday = manilaWeekday(anchor) ?? 1;
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const from = addManilaDays(anchor, mondayOffset);
  return { from, to: addManilaDays(from, 6) };
}

export function calendarMonth(anchor: string): { from: string; to: string } {
  const from = `${anchor.slice(0, 7)}-01`;
  const [yearText, monthText] = anchor.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const next =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { from, to: addManilaDays(next, -1) };
}

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to && dates.length <= REPORT_RANGE_LIMIT_DAYS) {
    dates.push(cursor);
    cursor = addManilaDays(cursor, 1);
  }
  return dates;
}

export function resolveReportWindow(input: {
  period: string;
  anchor: string;
  from: string;
  to: string;
  today: string;
}): {
  period: ReportPeriod;
  from: string;
  to: string;
  anchor: string;
  error: string | null;
} {
  const period: ReportPeriod =
    input.period === "weekly" || input.period === "monthly" || input.period === "custom"
      ? input.period
      : "daily";
  const anchor = isDateKey(input.anchor) ? input.anchor : input.today;
  if (period === "weekly") {
    const week = calendarWeek(anchor);
    return { period, anchor, ...week, error: null };
  }
  if (period === "monthly") {
    const month = calendarMonth(anchor);
    return { period, anchor, ...month, error: null };
  }
  if (period === "daily") {
    return { period, anchor, from: anchor, to: anchor, error: null };
  }
  const from = isDateKey(input.from) ? input.from : anchor;
  const to = isDateKey(input.to) ? input.to : anchor;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  if (eachDate(start, end).length > REPORT_RANGE_LIMIT_DAYS) {
    return {
      period,
      anchor,
      from: start,
      to: end,
      error: `Choose a range of ${REPORT_RANGE_LIMIT_DAYS} days or fewer.`,
    };
  }
  return { period, anchor, from: start, to: end, error: null };
}

export function parseSummaryCategory(value: string): SummaryCategory {
  return SUMMARY_CATEGORIES.includes(value as SummaryCategory)
    ? (value as SummaryCategory)
    : "expected";
}

export function resolveAttendanceScope(input: {
  role: "hr" | "supervisor" | "employee";
  viewerId: string;
  assignedEmployeeIds: string[];
  requestedEmployeeId: string;
}): { employeeIds: string[] | null; denied: boolean } {
  if (input.role === "hr") {
    return {
      employeeIds: input.requestedEmployeeId ? [input.requestedEmployeeId] : null,
      denied: false,
    };
  }
  if (input.role === "employee") {
    return {
      employeeIds: [input.viewerId],
      denied: Boolean(input.requestedEmployeeId) && input.requestedEmployeeId !== input.viewerId,
    };
  }
  const assigned = new Set(input.assignedEmployeeIds);
  if (input.requestedEmployeeId && !assigned.has(input.requestedEmployeeId)) {
    return { employeeIds: [], denied: true };
  }
  return {
    employeeIds: input.requestedEmployeeId
      ? [input.requestedEmployeeId]
      : [...assigned],
    denied: false,
  };
}

export function organizationAttendanceAllowed(role: string): boolean {
  return role === "hr";
}

export function buildAttendanceReport(input: {
  period: ReportPeriod;
  from: string;
  to: string;
  anchor: string;
  category: SummaryCategory;
  people: ReportPerson[];
  punches: ReportPunch[];
  now: Date;
  scheduleColumnReady: boolean;
}): AttendanceReport {
  const dates = eachDate(input.from, input.to);
  const people = new Map(input.people.map((person) => [person.id, person]));
  const punchesByKey = new Map<string, ReportPunch>();
  for (const punch of input.punches) {
    punchesByKey.set(`${punch.employeeId}:${punch.attendanceDate}`, punch);
  }

  const expected: NamedRow[] = [];
  const missingTimeIn: NamedRow[] = [];
  const noRecord: NamedRow[] = [];
  const potentialAbsence: NamedRow[] = [];
  const unconfiguredPeople = new Map<string, ReportPerson>();
  const dayExpected = new Map<string, number>();
  const dayMatched = new Map<string, number>();

  for (const date of dates) {
    const weekday = manilaWeekday(date);
    for (const person of input.people) {
      if (!person.active || !person.startDate || !person.shiftStart || !person.shiftEnd) {
        continue;
      }
      if (date < person.startDate) {
        continue;
      }
      if (!person.scheduledWeekdays?.length) {
        if (input.scheduleColumnReady) {
          unconfiguredPeople.set(person.id, person);
        }
        continue;
      }
      if (weekday == null || !person.scheduledWeekdays.includes(weekday)) {
        continue;
      }
      const row = personRow(person, date, "Scheduled attendance", "Expected to work. This is not an absence ruling.");
      expected.push(row);
      dayExpected.set(date, (dayExpected.get(date) ?? 0) + 1);
      const punch = punchesByKey.get(`${person.id}:${date}`);
      if (!punch) {
        const missing = personRow(
          person,
          date,
          "No Time In",
          "Scheduled day with no attendance record. This is not an official absence.",
        );
        missingTimeIn.push(missing);
        noRecord.push(missing);
        potentialAbsence.push({
          ...missing,
          statusLabel: "Potential absence",
          detail:
            "Scheduled attendance has no qualifying record. No approved absence policy or leave record exists, so this is not an official absence.",
        });
      } else {
        dayMatched.set(date, (dayMatched.get(date) ?? 0) + 1);
      }
    }
  }

  const timeIn: NamedRow[] = [];
  const timeOut: NamedRow[] = [];
  const late: NamedRow[] = [];
  const missingTimeOut: NamedRow[] = [];
  const inProgress: NamedRow[] = [];
  const review: NamedRow[] = [];

  for (const punch of input.punches) {
    if (punch.attendanceDate < input.from || punch.attendanceDate > input.to) {
      continue;
    }
    const person = people.get(punch.employeeId);
    const computed = shiftNote(new Date(punch.timeInAt), punch.shiftStart, punch.shiftEnd);
    const minutes = lateMinutes(new Date(punch.timeInAt), punch.shiftStart, punch.shiftEnd);
    const ended = shiftEndPassed(punch.attendanceDate, punch.shiftStart, punch.shiftEnd, input.now);
    const base = {
      key: punch.id,
      recordId: punch.id,
      employeeId: punch.employeeId,
      employeeNumber: person?.employeeNumber ?? null,
      employeeName: person?.name ?? "Employee",
      supervisorName: person?.supervisorName ?? null,
      postName: punch.postName,
      shiftName: punch.shiftName,
      shiftStart: punch.shiftStart,
      attendanceDate: punch.attendanceDate,
      timeInLabel: formatManilaDateTime(punch.timeInAt),
      minutesLate: minutes,
      statusLabel: punch.status === "completed" ? "Completed" : "Time Out not recorded",
      detail: "",
    };
    timeIn.push({ ...base, detail: "Recorded Time In." });
    if (punch.timeOutAt) {
      timeOut.push({
        ...base,
        detail: `Time Out ${formatManilaDateTime(punch.timeOutAt)}.`,
      });
    }
    if (minutes != null) {
      late.push({
        ...base,
        statusLabel: "Late",
        detail: `${minutes} minute${minutes === 1 ? "" : "s"} after shift start. No grace period is configured.`,
      });
    }
    if (punch.storedShiftNote !== computed) {
      review.push({
        ...base,
        statusLabel: "Needs data review",
        detail: `Stored shift note is ${punch.storedShiftNote ?? "blank"}; the current rule calculates ${computed ?? "unavailable"}. The late list uses the calculated rule, not the stored flag. This is not an attendance-approval workflow.`,
      });
    }
    if (punch.status === "open" && ended === null) {
      review.push({
        ...base,
        key: `${punch.id}:shift-end`,
        statusLabel: "Shift end unknown",
        detail: "Time Out is blank, and the shift times cannot be evaluated. No cutoff was invented.",
      });
    } else if (punch.status === "open" && ended === false) {
      inProgress.push({
        ...base,
        statusLabel: "Shift not finished",
        detail: "Time In is recorded and the scheduled shift end has not passed. This is incomplete attendance, not a confirmed missing Time Out.",
      });
    } else if (punch.status === "open" && ended === true) {
      missingTimeOut.push({
        ...base,
        statusLabel: "Missing Time Out",
        detail:
          "Time In exists, Time Out is blank, and the scheduled shift end has passed. This is not an official violation or correction workflow.",
      });
    }
  }

  const issueCount = new Map<string, number>();
  for (const row of [...late, ...missingTimeIn, ...missingTimeOut]) {
    issueCount.set(row.employeeId, (issueCount.get(row.employeeId) ?? 0) + 1);
  }
  const repeated: NamedRow[] = [...issueCount.entries()]
    .filter(([, count]) => count >= 2)
    .map(([employeeId, count]) => {
      const person = people.get(employeeId);
      return personRow(
        person ?? {
          id: employeeId,
          name: "Employee",
          employeeNumber: null,
          active: true,
          supervisorId: null,
          supervisorName: null,
          postName: null,
          locationId: null,
          locationName: null,
          shiftName: null,
          shiftStart: null,
          shiftEnd: null,
          startDate: null,
          scheduledWeekdays: null,
        },
        input.from,
        "Repeated issues",
        `${count} late, missing Time In, or missing Time Out items in this period.`,
      );
    });

  const unconfigured = [...unconfiguredPeople.values()].map((person) =>
    personRow(
      person,
      input.from,
      "Workdays not configured",
      "This shift has no scheduled weekdays. Those days are not counted as expected work or absences.",
    ),
  );

  const lists: Record<SummaryCategory, NamedRow[]> = {
    expected,
    time_in: timeIn,
    time_out: timeOut,
    late,
    missing_time_in: missingTimeIn,
    missing_time_out: missingTimeOut,
    no_record: noRecord,
    potential_absence: potentialAbsence,
    in_progress: inProgress,
    review,
    repeated,
    unconfigured,
  };
  const counts = Object.fromEntries(
    SUMMARY_CATEGORIES.map((category) => [category, lists[category].length]),
  ) as Record<SummaryCategory, number>;

  const daily: DayBreakdown[] = dates.map((date) => ({
    date,
    expected: expected.filter((row) => row.attendanceDate === date).length,
    timeIn: timeIn.filter((row) => row.attendanceDate === date).length,
    timeOut: timeOut.filter((row) => row.attendanceDate === date).length,
    late: late.filter((row) => row.attendanceDate === date).length,
    missingTimeIn: missingTimeIn.filter((row) => row.attendanceDate === date).length,
    missingTimeOut: missingTimeOut.filter((row) => row.attendanceDate === date).length,
  }));

  const personnelIds = new Set<string>([
    ...input.people.map((person) => person.id),
    ...input.punches.map((punch) => punch.employeeId),
  ]);
  const personnel: PersonBreakdown[] = [...personnelIds].map((employeeId) => {
    const person = people.get(employeeId);
    return {
      employeeId,
      employeeName: person?.name ?? "Employee",
      employeeNumber: person?.employeeNumber ?? null,
      expected: expected.filter((row) => row.employeeId === employeeId).length,
      recorded: timeIn.filter((row) => row.employeeId === employeeId).length,
      late: late.filter((row) => row.employeeId === employeeId).length,
      missingTimeIn: missingTimeIn.filter((row) => row.employeeId === employeeId).length,
      missingTimeOut: missingTimeOut.filter((row) => row.employeeId === employeeId).length,
    };
  });

  const limitations = [
    "Expected work uses the current assignment only, on or after its start date. Past assignment changes are not stored, so historical schedules cannot be reconstructed.",
    "A day is scheduled only when HR has saved weekdays on that shift. Unscheduled days are not absences. No rest-day or leave table exists.",
    "There is no grace period. Late means Time In after the scheduled shift start under the existing rule.",
    "Missing Time Out is listed only after the scheduled shift end. An open record before that is incomplete, not a confirmed violation.",
    "Official absence is unavailable. Potential absence is a scheduled day with no attendance record, not an agency determination.",
    "Completion rate uses scheduled employee-days as the denominator and Time In on those days as the numerator.",
  ];
  if (!input.scheduleColumnReady) {
    limitations.unshift(
      "Shift workdays are unavailable until supabase/schema.sql is applied. Expected attendance is not calculated.",
    );
  }

  return {
    period: input.period,
    from: input.from,
    to: input.to,
    anchor: input.anchor,
    category: input.category,
    completionRate: expected.length ? dayMatchedTotal(dayMatched) / expected.length : null,
    completionDenominator:
      "Time In records on scheduled employee-days ÷ scheduled employee-days. Unconfigured and unscheduled days are excluded.",
    officialAbsence: "unavailable",
    limitations,
    daysWithoutScheduledAttendance: dates.filter(
      (date) => (dayExpected.get(date) ?? 0) > 0 && (dayMatched.get(date) ?? 0) === 0,
    ),
    counts,
    lists,
    daily,
    personnel,
  };
}

function dayMatchedTotal(matched: Map<string, number>): number {
  let total = 0;
  for (const value of matched.values()) {
    total += value;
  }
  return total;
}

function personRow(
  person: ReportPerson,
  date: string,
  statusLabel: string,
  detail: string,
): NamedRow {
  return {
    key: `${person.id}:${date}:${statusLabel}`,
    recordId: null,
    employeeId: person.id,
    employeeNumber: person.employeeNumber,
    employeeName: person.name,
    supervisorName: person.supervisorName,
    postName: person.postName,
    shiftName: person.shiftName,
    shiftStart: person.shiftStart,
    attendanceDate: date,
    timeInLabel: "Not recorded",
    minutesLate: null,
    statusLabel,
    detail,
  };
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && manilaDateKey(new Date(`${value}T12:00:00+08:00`)) === value;
}
