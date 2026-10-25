import "server-only";

import { manilaDateKey } from "@/lib/attendance/policy";
import {
  buildAttendanceReport,
  organizationAttendanceAllowed,
  parseSummaryCategory,
  resolveAttendanceScope,
  resolveReportWindow,
  type AttendanceReport,
  type ReportPeriod,
  type ReportPerson,
  type ReportPunch,
  type SummaryCategory,
} from "@/lib/attendance/report";
import { isMissingAttendanceSchema } from "@/lib/attendance/queries";
import type { ShiftNote } from "@/lib/attendance/policy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AttendanceReportView = {
  ready: boolean;
  message: string | null;
  denied: boolean;
  report: AttendanceReport | null;
  employees: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  filters: {
    period: ReportPeriod;
    anchor: string;
    from: string;
    to: string;
    category: SummaryCategory;
    employeeId: string;
    supervisorId: string;
    locationId: string;
  };
};

const emptyReport = null;

function weekdaysFromShift(shift: object | undefined): number[] | null {
  if (!shift || !("scheduled_weekdays" in shift) || !Array.isArray(shift.scheduled_weekdays)) return null;
  return shift.scheduled_weekdays.filter(
    (day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
  );
}

export async function loadAttendanceReport(input: {
  role: "hr" | "supervisor" | "employee";
  viewerId: string;
  params: Record<string, string | string[] | undefined>;
  now?: Date;
}): Promise<AttendanceReportView> {
  const now = input.now ?? new Date();
  const today = manilaDateKey(now);
  const requestedEmployee = first(input.params.employee);
  const requestedSupervisor = first(input.params.supervisor);
  const locationId = first(input.params.location);
  const window = resolveReportWindow({
    period: first(input.params.period),
    anchor: first(input.params.anchor) || first(input.params.from),
    from: first(input.params.from),
    to: first(input.params.to),
    today,
  });
  const category = parseSummaryCategory(first(input.params.category));
  const filters = {
    period: window.period,
    anchor: window.anchor,
    from: window.from,
    to: window.to,
    category,
    employeeId: requestedEmployee,
    supervisorId: input.role === "hr" ? requestedSupervisor : "",
    locationId,
  };
  if (input.role !== "hr" && input.role !== "supervisor" && input.role !== "employee") {
    return unavailable(filters, "This report is not available.", true);
  }
  if (!organizationAttendanceAllowed(input.role) && input.role === "hr") {
    return unavailable(filters, "Organization attendance is limited to HR.", true);
  }

  const supabase = await createSupabaseServerClient();
  let assignedIds: string[] = [];
  if (input.role === "supervisor") {
    const assigned = await supabase
      .from("personnel_assignments")
      .select("employee_id")
      .eq("supervisor_id", input.viewerId);
    if (assigned.error) {
      return unavailable(filters, assigned.error.message, false);
    }
    assignedIds = assigned.data.map((row) => row.employee_id);
  }
  const scope = resolveAttendanceScope({
    role: input.role,
    viewerId: input.viewerId,
    assignedEmployeeIds: assignedIds,
    requestedEmployeeId: requestedEmployee,
  });
  if (scope.denied) {
    return unavailable(filters, "That attendance report is outside your access.", true);
  }
  if (window.error) {
    return unavailable(filters, window.error, false);
  }

  let employeeQuery = supabase
    .from("profiles")
    .select("id, first_name, last_name, employee_number, is_active, role")
    .eq("role", "employee");
  if (scope.employeeIds) {
    if (!scope.employeeIds.length) {
      return readyEmpty(filters, now, category, window);
    }
    employeeQuery = employeeQuery.in("id", scope.employeeIds);
  }
  const employeesResult = await employeeQuery;
  if (employeesResult.error) {
    return unavailable(filters, employeesResult.error.message, false);
  }

  const employeeIds = employeesResult.data.map((employee) => employee.id);
  const assignmentsResult = employeeIds.length
    ? await supabase
        .from("personnel_assignments")
        .select("employee_id, supervisor_id, post_id, duty_location_id, duty_shift_id, start_date")
        .in("employee_id", employeeIds)
    : { data: [], error: null };
  if (assignmentsResult.error) {
    return unavailable(filters, assignmentsResult.error.message, false);
  }

  const shiftIds = [...new Set((assignmentsResult.data ?? []).map((row) => row.duty_shift_id))];
  const postIds = [...new Set((assignmentsResult.data ?? []).map((row) => row.post_id))];
  const locationIds = [...new Set((assignmentsResult.data ?? []).map((row) => row.duty_location_id))];
  const supervisorIds = [...new Set((assignmentsResult.data ?? []).map((row) => row.supervisor_id))];

  const shiftsResult = shiftIds.length
    ? await supabase
        .from("duty_shifts")
        .select("id, name, start_time, end_time, scheduled_weekdays")
        .in("id", shiftIds)
    : { data: [], error: null };
  let scheduleColumnReady = true;
  let shifts = shiftsResult.data ?? [];
  if (shiftsResult.error) {
    if (!/scheduled_weekdays/i.test(shiftsResult.error.message)) {
      return unavailable(filters, shiftsResult.error.message, false);
    }
    scheduleColumnReady = false;
    const fallback = shiftIds.length
      ? await supabase.from("duty_shifts").select("id, name, start_time, end_time").in("id", shiftIds)
      : { data: [], error: null };
    if (fallback.error) {
      return unavailable(filters, fallback.error.message, false);
    }
    shifts = (fallback.data ?? []).map((shift) => ({ ...shift, scheduled_weekdays: null }));
  }

  const [postsResult, locationsResult, supervisorsResult] = await Promise.all([
    postIds.length
      ? supabase.from("posts").select("id, name").in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length
      ? supabase.from("duty_locations").select("id, name").in("id", locationIds)
      : Promise.resolve({ data: [], error: null }),
    supervisorIds.length
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", supervisorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (postsResult.error || locationsResult.error || supervisorsResult.error) {
    return unavailable(filters, "Unable to load assignment details for the attendance summary.", false);
  }

  let attendanceQuery = supabase
    .from("attendance_records")
    .select(
      "id, employee_id, attendance_date, time_in_at, time_out_at, status, shift_note, duty_shift_id, post_id, duty_location_id",
    )
    .gte("attendance_date", window.from)
    .lte("attendance_date", window.to);
  if (scope.employeeIds) {
    attendanceQuery = attendanceQuery.in("employee_id", scope.employeeIds);
  }
  if (locationId) {
    attendanceQuery = attendanceQuery.eq("duty_location_id", locationId);
  }
  const attendanceResult = await attendanceQuery;
  if (attendanceResult.error) {
    if (isMissingAttendanceSchema(attendanceResult.error.message)) {
      return unavailable(
        filters,
        "Attendance summaries are unavailable until supabase/schema.sql is applied.",
        false,
      );
    }
    return unavailable(filters, attendanceResult.error.message, false);
  }

  const recordShiftIds = [
    ...new Set((attendanceResult.data ?? []).map((row) => row.duty_shift_id).filter((id) => !shiftIds.includes(id))),
  ];
  const extraShifts = recordShiftIds.length
    ? await supabase.from("duty_shifts").select("id, name, start_time, end_time").in("id", recordShiftIds)
    : { data: [], error: null };
  if (extraShifts.error) {
    return unavailable(filters, extraShifts.error.message, false);
  }

  const shiftById = new Map(
    [...shifts, ...(extraShifts.data ?? [])].map((shift) => [shift.id, shift]),
  );
  const postById = new Map((postsResult.data ?? []).map((post) => [post.id, post.name]));
  const locationById = new Map((locationsResult.data ?? []).map((location) => [location.id, location.name]));
  const supervisorById = new Map(
    (supervisorsResult.data ?? []).map((supervisor) => [
      supervisor.id,
      [supervisor.first_name, supervisor.last_name].filter(Boolean).join(" ") || "Supervisor",
    ]),
  );
  const assignmentByEmployee = new Map(
    (assignmentsResult.data ?? []).map((assignment) => [assignment.employee_id, assignment]),
  );

  const people: ReportPerson[] = employeesResult.data.flatMap((employee) => {
    const assignment = assignmentByEmployee.get(employee.id);
    if (requestedSupervisor && assignment?.supervisor_id !== requestedSupervisor) {
      return [];
    }
    if (locationId && assignment?.duty_location_id !== locationId) {
      return [];
    }
    const shift = assignment ? shiftById.get(assignment.duty_shift_id) : undefined;
    return [
      {
        id: employee.id,
        name: [employee.first_name, employee.last_name].filter(Boolean).join(" ") || "Employee",
        employeeNumber: employee.employee_number,
        active: employee.is_active,
        supervisorId: assignment?.supervisor_id ?? null,
        supervisorName: assignment ? supervisorById.get(assignment.supervisor_id) ?? null : null,
        postName: assignment ? postById.get(assignment.post_id) ?? null : null,
        locationId: assignment?.duty_location_id ?? null,
        locationName: assignment ? locationById.get(assignment.duty_location_id) ?? null : null,
        shiftName: shift?.name ?? null,
        shiftStart: shift?.start_time ?? null,
        shiftEnd: shift?.end_time ?? null,
        startDate: assignment?.start_date ?? null,
        scheduledWeekdays: weekdaysFromShift(shift),
      },
    ];
  });
  const visibleIds = new Set(people.map((person) => person.id));
  const punches: ReportPunch[] = (attendanceResult.data ?? []).flatMap((row) => {
    if (requestedSupervisor && !visibleIds.has(row.employee_id) && assignmentByEmployee.get(row.employee_id)?.supervisor_id !== requestedSupervisor) {
      return [];
    }
    if ((requestedSupervisor || locationId) && !visibleIds.has(row.employee_id)) {
      return [];
    }
    const shift = shiftById.get(row.duty_shift_id);
    return [
      {
        id: row.id,
        employeeId: row.employee_id,
        attendanceDate: row.attendance_date,
        timeInAt: row.time_in_at,
        timeOutAt: row.time_out_at,
        status: row.status,
        storedShiftNote: row.shift_note as ShiftNote | null,
        shiftStart: shift?.start_time ?? "",
        shiftEnd: shift?.end_time ?? "",
        postName: postById.get(row.post_id) ?? "Unavailable",
        locationName: locationById.get(row.duty_location_id) ?? "Unavailable",
        shiftName: shift?.name ?? "Unavailable",
        locationId: row.duty_location_id,
      },
    ];
  });

  const report = buildAttendanceReport({
    period: window.period,
    from: window.from,
    to: window.to,
    anchor: window.anchor,
    category,
    people,
    punches,
    now,
    scheduleColumnReady,
  });
  return {
    ready: true,
    message: null,
    denied: false,
    report,
    employees: people.map((person) => ({ id: person.id, name: person.name })),
    supervisors: [...supervisorById.entries()].map(([id, name]) => ({ id, name })),
    locations: [...locationById.entries()].map(([id, name]) => ({ id, name })),
    filters,
  };
}

function readyEmpty(
  filters: AttendanceReportView["filters"],
  now: Date,
  category: SummaryCategory,
  window: ReturnType<typeof resolveReportWindow>,
): AttendanceReportView {
  return {
    ready: true,
    message: null,
    denied: false,
    report: buildAttendanceReport({
      period: window.period,
      from: window.from,
      to: window.to,
      anchor: window.anchor,
      category,
      people: [],
      punches: [],
      now,
      scheduleColumnReady: true,
    }),
    employees: [],
    supervisors: [],
    locations: [],
    filters,
  };
}

function unavailable(
  filters: AttendanceReportView["filters"],
  message: string,
  denied: boolean,
): AttendanceReportView {
  return {
    ready: false,
    message,
    denied,
    report: emptyReport,
    employees: [],
    supervisors: [],
    locations: [],
    filters,
  };
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
