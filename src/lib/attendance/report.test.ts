import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAttendanceReport,
  calendarMonth,
  calendarWeek,
  organizationAttendanceAllowed,
  resolveAttendanceScope,
  resolveReportWindow,
  type ReportPerson,
  type ReportPunch,
} from "./report.ts";

const person: ReportPerson = {
  id: "emp-1",
  name: "Ana Cruz",
  employeeNumber: "E-001",
  active: true,
  supervisorId: "sup-1",
  supervisorName: "Ben Reyes",
  postName: "Gate",
  locationId: "loc-1",
  locationName: "Main",
  shiftName: "Day",
  shiftStart: "08:00",
  shiftEnd: "17:00",
  startDate: "2026-10-01",
  scheduledWeekdays: [1, 2, 3, 4, 5],
};

function punch(overrides: Partial<ReportPunch> = {}): ReportPunch {
  return {
    id: "rec-1",
    employeeId: "emp-1",
    attendanceDate: "2026-10-20",
    timeInAt: "2026-10-20T00:30:00.000Z",
    timeOutAt: "2026-10-20T09:00:00.000Z",
    status: "completed",
    storedShiftNote: "late",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    postName: "Gate",
    locationName: "Main",
    shiftName: "Day",
    locationId: "loc-1",
    ...overrides,
  };
}

test("daily, weekly, and monthly windows are different Philippine periods", () => {
  const today = "2026-10-20";
  assert.deepEqual(resolveReportWindow({ period: "daily", anchor: today, from: "", to: "", today }), {
    period: "daily",
    anchor: today,
    from: today,
    to: today,
    error: null,
  });
  assert.deepEqual(calendarWeek(today), { from: "2026-10-19", to: "2026-10-25" });
  assert.deepEqual(calendarMonth(today), { from: "2026-10-01", to: "2026-10-31" });
  const week = resolveReportWindow({ period: "weekly", anchor: today, from: "", to: "", today });
  const month = resolveReportWindow({ period: "monthly", anchor: today, from: "", to: "", today });
  assert.notDeepEqual([week.from, week.to], [month.from, month.to]);
  assert.equal(week.from < week.to && month.from < month.to, true);
});

test("summaries match named lists and do not treat unscheduled days as absences", () => {
  const report = buildAttendanceReport({
    period: "weekly",
    from: "2026-10-19",
    to: "2026-10-25",
    anchor: "2026-10-20",
    category: "late",
    now: new Date("2026-10-20T10:00:00.000Z"),
    scheduleColumnReady: true,
    people: [person, { ...person, id: "emp-2", name: "Carlo Diaz", employeeNumber: "E-002", scheduledWeekdays: null }],
    punches: [
      punch(),
      punch({
        id: "rec-weekend",
        attendanceDate: "2026-10-24",
        timeInAt: "2026-10-24T00:00:00.000Z",
        storedShiftNote: "on_time",
      }),
    ],
  });

  assert.equal(report.counts.expected, 5);
  assert.equal(report.lists.expected.length, report.counts.expected);
  assert.equal(report.counts.late, 1);
  assert.equal(report.lists.late[0]?.employeeName, "Ana Cruz");
  assert.equal(report.lists.late[0]?.minutesLate, 30);
  assert.equal(report.counts.missing_time_in, 4);
  assert.equal(report.lists.missing_time_in.length, report.counts.missing_time_in);
  assert.equal(report.lists.potential_absence.length, report.counts.missing_time_in);
  assert.equal(report.officialAbsence, "unavailable");
  assert.equal(report.lists.expected.some((row) => row.attendanceDate === "2026-10-24"), false);
  assert.equal(report.counts.unconfigured, 1);
  assert.equal(report.daily.reduce((sum, day) => sum + day.expected, 0), report.counts.expected);
  assert.equal(report.daily.reduce((sum, day) => sum + day.timeIn, 0), report.counts.time_in);
  assert.equal(report.personnel.find((row) => row.employeeId === "emp-1")?.recorded, 2);
});

test("monthly aggregation includes every date and ignores days before the assignment start", () => {
  const report = buildAttendanceReport({
    period: "monthly",
    from: "2026-10-01",
    to: "2026-10-31",
    anchor: "2026-10-20",
    category: "expected",
    now: new Date("2026-10-31T12:00:00.000Z"),
    scheduleColumnReady: true,
    people: [{ ...person, startDate: "2026-10-20" }],
    punches: [],
  });
  assert.equal(report.daily.length, 31);
  assert.equal(report.lists.expected.some((row) => row.attendanceDate < "2026-10-20"), false);
  assert.equal(report.lists.expected[0]?.attendanceDate, "2026-10-20");
});

test("missing Time Out excludes a shift that has not ended", () => {
  const report = buildAttendanceReport({
    period: "daily",
    from: "2026-10-20",
    to: "2026-10-20",
    anchor: "2026-10-20",
    category: "missing_time_out",
    now: new Date("2026-10-20T02:00:00.000Z"),
    scheduleColumnReady: true,
    people: [person],
    punches: [punch({ timeOutAt: null, status: "open", timeInAt: "2026-10-20T00:30:00.000Z" })],
  });
  assert.equal(report.counts.missing_time_out, 0);
  assert.equal(report.counts.in_progress, 1);
  assert.equal(report.lists.missing_time_out.length, 0);
});

test("a stale late flag is not trusted when the current rule disagrees", () => {
  const report = buildAttendanceReport({
    period: "daily",
    from: "2026-10-20",
    to: "2026-10-20",
    anchor: "2026-10-20",
    category: "review",
    now: new Date("2026-10-20T10:00:00.000Z"),
    scheduleColumnReady: true,
    people: [person],
    punches: [punch({ timeInAt: "2026-10-20T00:00:00.000Z", storedShiftNote: "late" })],
  });
  assert.equal(report.counts.late, 0);
  assert.equal(report.counts.review, 1);
});

test("only HR may view organization attendance, and other roles stay in scope", () => {
  assert.equal(organizationAttendanceAllowed("hr"), true);
  assert.equal(organizationAttendanceAllowed("supervisor"), false);
  assert.equal(organizationAttendanceAllowed("employee"), false);
  assert.deepEqual(
    resolveAttendanceScope({
      role: "employee",
      viewerId: "emp-1",
      assignedEmployeeIds: [],
      requestedEmployeeId: "emp-2",
    }),
    { employeeIds: ["emp-1"], denied: true },
  );
  assert.equal(
    resolveAttendanceScope({
      role: "supervisor",
      viewerId: "sup-1",
      assignedEmployeeIds: ["emp-1"],
      requestedEmployeeId: "emp-2",
    }).denied,
    true,
  );
});
