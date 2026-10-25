import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  ATTENDANCE_PAGE_SIZE,
  durationMinutes,
  formatDuration,
  formatManilaDateTime,
  isOvernight,
  manilaDateKey,
  shiftNoteLabel,
  verificationLabel,
} from "@/lib/attendance/policy";
import type {
  AttendanceFilters,
  AttendanceView,
  DutyContext,
  MonitorData,
} from "@/lib/attendance/types";

export type { AttendanceFilters, AttendanceView, DutyContext, MonitorData };

const BUCKET = "attendance-evidence";

type AttendanceRow = Database["public"]["Tables"]["attendance_records"]["Row"];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMissingAttendanceSchema(message: string): boolean {
  return /attendance_records|schema cache|does not exist|geofence_radius_meters/i.test(
    message,
  );
}

export function readAttendanceFilters(
  params: Record<string, string | string[] | undefined>,
  now = new Date(),
): AttendanceFilters {
  const today = manilaDateKey(now);
  const from = first(params.from);
  const to = first(params.to);
  const status = first(params.status);
  const page = Number(first(params.page) || "1");
  const start = isDateKey(from) ? from : today;
  const end = isDateKey(to) ? to : today;
  return {
    from: start <= end ? start : end,
    to: start <= end ? end : start,
    status: status === "open" || status === "completed" ? status : "",
    employeeId: uuidPattern.test(first(params.employee)) ? first(params.employee) : "",
    locationId: uuidPattern.test(first(params.location)) ? first(params.location) : "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export async function getDutyContext(employeeId: string): Promise<DutyContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data: assignment, error } = await supabase
    .from("personnel_assignments")
    .select("id, post_id, duty_location_id, duty_shift_id, start_date")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) {
    throw new Error(`Unable to load your assignment: ${error.message}`);
  }
  if (!assignment) {
    return null;
  }

  const [postResult, locationResult, shiftResult] = await Promise.all([
    supabase.from("posts").select("name").eq("id", assignment.post_id).maybeSingle(),
    supabase
      .from("duty_locations")
      .select("name, address, latitude, longitude, geofence_radius_meters")
      .eq("id", assignment.duty_location_id)
      .maybeSingle(),
    supabase
      .from("duty_shifts")
      .select("name, start_time, end_time")
      .eq("id", assignment.duty_shift_id)
      .maybeSingle(),
  ]);
  if (postResult.error || shiftResult.error) {
    throw new Error("Unable to load the assigned duty details.");
  }
  if (locationResult.error) {
    if (!isMissingAttendanceSchema(locationResult.error.message)) {
      throw new Error("Unable to load the assigned duty location.");
    }
    const fallback = await supabase
      .from("duty_locations")
      .select("name, address")
      .eq("id", assignment.duty_location_id)
      .maybeSingle();
    if (fallback.error) {
      throw new Error("Unable to load the assigned duty location.");
    }
    return {
      assignmentId: assignment.id,
      postName: postResult.data?.name ?? "Unavailable",
      locationName: fallback.data?.name ?? "Unavailable",
      locationAddress: fallback.data?.address ?? null,
      shiftName: shiftResult.data?.name ?? "Unavailable",
      shiftStart: shiftResult.data?.start_time ?? "",
      shiftEnd: shiftResult.data?.end_time ?? "",
      startDate: assignment.start_date,
      latitude: null,
      longitude: null,
      radiusMeters: null,
    };
  }

  return {
    assignmentId: assignment.id,
    postName: postResult.data?.name ?? "Unavailable",
    locationName: locationResult.data?.name ?? "Unavailable",
    locationAddress: locationResult.data?.address ?? null,
    shiftName: shiftResult.data?.name ?? "Unavailable",
    shiftStart: shiftResult.data?.start_time ?? "",
    shiftEnd: shiftResult.data?.end_time ?? "",
    startDate: assignment.start_date,
    latitude: locationResult.data?.latitude ?? null,
    longitude: locationResult.data?.longitude ?? null,
    radiusMeters: locationResult.data?.geofence_radius_meters ?? null,
  };
}

export async function getOwnAttendanceState(employeeId: string): Promise<{
  schemaReady: boolean;
  open: boolean;
  completedToday: boolean;
  today: AttendanceView | null;
}> {
  const supabase = await createSupabaseServerClient();
  const today = manilaDateKey(new Date());
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("employee_id", employeeId)
    .or(`status.eq.open,attendance_date.eq.${today}`)
    .order("time_in_at", { ascending: false });

  if (error) {
    if (isMissingAttendanceSchema(error.message)) {
      return { schemaReady: false, open: false, completedToday: false, today: null };
    }
    throw new Error(`Unable to load attendance: ${error.message}`);
  }

  const rows = data ?? [];
  const views = await presentRecords(rows, new Map());
  return {
    schemaReady: true,
    open: rows.some((row) => row.status === "open"),
    completedToday: rows.some(
      (row) => row.attendance_date === today && row.status === "completed",
    ),
    today: views.find((view) => view.attendanceDate === today) ?? views[0] ?? null,
  };
}

export async function listOwnAttendance(
  employeeId: string,
  filters: AttendanceFilters,
): Promise<{ schemaReady: boolean; records: AttendanceView[]; pageCount: number }> {
  const listed = await listAttendance(filters, employeeId);
  return {
    schemaReady: listed.schemaReady,
    records: listed.records,
    pageCount: listed.pageCount,
  };
}

export async function loadAttendanceMonitor(
  filters: AttendanceFilters,
  scopeEmployeeIds: string[] | null,
): Promise<MonitorData> {
  const supabase = await createSupabaseServerClient();
  const listed = await listAttendance(filters, null, scopeEmployeeIds);
  const employeesResult = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, is_active")
    .eq("role", "employee")
    .order("last_name");
  const locationsResult = await supabase.from("duty_locations").select("id, name").order("name");

  if (employeesResult.error && !isMissingAttendanceSchema(employeesResult.error.message)) {
    throw new Error(`Unable to load employees: ${employeesResult.error.message}`);
  }
  if (locationsResult.error) {
    throw new Error(`Unable to load duty locations: ${locationsResult.error.message}`);
  }

  const allowed = scopeEmployeeIds ? new Set(scopeEmployeeIds) : null;
  const employees = (employeesResult.data ?? [])
    .filter((employee) => employee.is_active && (!allowed || allowed.has(employee.id)))
    .map((employee) => ({
      id: employee.id,
      name:
        [employee.first_name, employee.last_name].filter(Boolean).join(" ") || employee.email,
    }));

  const summaries = await summarize(filters, scopeEmployeeIds, employees.map((employee) => employee.id));
  return {
    schemaReady: listed.schemaReady,
    message: listed.message,
    filters,
    pageCount: listed.pageCount,
    records: listed.records,
    summaries,
    employees,
    locations: locationsResult.data ?? [],
  };
}

async function listAttendance(
  filters: AttendanceFilters,
  employeeId: string | null,
  scopeEmployeeIds: string[] | null = null,
): Promise<{
  schemaReady: boolean;
  message: string | null;
  records: AttendanceView[];
  pageCount: number;
}> {
  if (scopeEmployeeIds && scopeEmployeeIds.length === 0) {
    return { schemaReady: true, message: null, records: [], pageCount: 1 };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("attendance_records")
    .select("*", { count: "exact" })
    .gte("attendance_date", filters.from)
    .lte("attendance_date", filters.to)
    .order("attendance_date", { ascending: false })
    .order("time_in_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  } else if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }
  if (scopeEmployeeIds) {
    query = query.in("employee_id", scopeEmployeeIds);
  }
  if (filters.locationId) {
    query = query.eq("duty_location_id", filters.locationId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const from = (filters.page - 1) * ATTENDANCE_PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + ATTENDANCE_PAGE_SIZE - 1);
  if (error) {
    if (isMissingAttendanceSchema(error.message)) {
      return {
        schemaReady: false,
        message:
          "Attendance storage is not ready. Re-run supabase/schema.sql in the Supabase SQL Editor, including the private attendance-evidence bucket.",
        records: [],
        pageCount: 1,
      };
    }
    throw new Error(`Unable to load attendance records: ${error.message}`);
  }

  const rows = data ?? [];
  const names = await employeeNames(rows.map((row) => row.employee_id));
  return {
    schemaReady: true,
    message: null,
    records: await presentRecords(rows, names),
    pageCount: Math.max(1, Math.ceil((count ?? 0) / ATTENDANCE_PAGE_SIZE)),
  };
}

async function summarize(
  filters: AttendanceFilters,
  scopeEmployeeIds: string[] | null,
  employeeIds: string[],
): Promise<MonitorData["summaries"]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("attendance_records")
    .select("employee_id, status, shift_note")
    .gte("attendance_date", filters.from)
    .lte("attendance_date", filters.to);
  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }
  if (scopeEmployeeIds) {
    query = query.in("employee_id", scopeEmployeeIds);
  }
  if (filters.locationId) {
    query = query.eq("duty_location_id", filters.locationId);
  }

  const { data, error } = await query;
  if (error) {
    return { records: 0, completed: 0, missingTimeOut: 0, late: 0, noTimeIn: null };
  }
  const rows = data ?? [];
  const singleDay = filters.from === filters.to;
  const present = new Set(rows.map((row) => row.employee_id));
  const expected = filters.employeeId ? [filters.employeeId] : employeeIds;
  return {
    records: rows.length,
    completed: rows.filter((row) => row.status === "completed").length,
    missingTimeOut: rows.filter((row) => row.status === "open").length,
    late: rows.filter((row) => row.shift_note === "late").length,
    noTimeIn: singleDay ? expected.filter((id) => !present.has(id)).length : null,
  };
}

async function employeeNames(ids: string[]): Promise<Map<string, { name: string; number: string | null }>> {
  const unique = [...new Set(ids)];
  const names = new Map<string, { name: string; number: string | null }>();
  if (!unique.length) {
    return names;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, employee_number")
    .in("id", unique);
  if (error) {
    throw new Error(`Unable to load attendance names: ${error.message}`);
  }
  for (const profile of data ?? []) {
    names.set(profile.id, {
      name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email,
      number: profile.employee_number,
    });
  }
  return names;
}

async function presentRecords(
  rows: AttendanceRow[],
  names: Map<string, { name: string; number: string | null }>,
): Promise<AttendanceView[]> {
  if (!rows.length) {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  const postIds = [...new Set(rows.map((row) => row.post_id))];
  const locationIds = [...new Set(rows.map((row) => row.duty_location_id))];
  const shiftIds = [...new Set(rows.map((row) => row.duty_shift_id))];
  const [posts, locations, shifts] = await Promise.all([
    supabase.from("posts").select("id, name").in("id", postIds),
    supabase.from("duty_locations").select("id, name").in("id", locationIds),
    supabase.from("duty_shifts").select("id, name, start_time, end_time").in("id", shiftIds),
  ]);
  if (posts.error || locations.error || shifts.error) {
    throw new Error("Unable to load attendance duty details.");
  }
  const postNames = new Map((posts.data ?? []).map((post) => [post.id, post.name]));
  const locationNames = new Map((locations.data ?? []).map((location) => [location.id, location.name]));
  const shiftNames = new Map(
    (shifts.data ?? []).map((shift) => [
      shift.id,
      `${shift.name} (${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)})`,
    ]),
  );
  const signed = await signEvidence(
    rows.flatMap((row) => [row.time_in_photo_path, row.time_out_photo_path ?? ""]),
  );

  return rows.map((row) => {
    const person = names.get(row.employee_id);
    return {
      id: row.id,
      employeeName: person?.name ?? "Employee",
      employeeNumber: person?.number ?? null,
      attendanceDate: row.attendance_date,
      postName: postNames.get(row.post_id) ?? "Unavailable",
      locationName: locationNames.get(row.duty_location_id) ?? "Unavailable",
      shiftLabel: shiftNames.get(row.duty_shift_id) ?? "Unavailable",
      timeInLabel: formatManilaDateTime(row.time_in_at),
      timeOutLabel: formatManilaDateTime(row.time_out_at),
      durationLabel: formatDuration(durationMinutes(row.time_in_at, row.time_out_at)),
      status: row.status,
      timeInVerification: verificationLabel(row.time_in_verification),
      timeOutVerification: verificationLabel(row.time_out_verification),
      shiftNote: shiftNoteLabel(row.shift_note),
      overnight: isOvernight(row.time_in_at, row.time_out_at),
      timeInPhotoUrl: signed.get(row.time_in_photo_path) ?? null,
      timeOutPhotoUrl: row.time_out_photo_path
        ? signed.get(row.time_out_photo_path) ?? null
        : null,
      timeInCoordinates: coordinates(
        row.time_in_latitude,
        row.time_in_longitude,
        row.time_in_accuracy_m,
      ),
      timeOutCoordinates: coordinates(
        row.time_out_latitude,
        row.time_out_longitude,
        row.time_out_accuracy_m,
      ),
      timeInPlace: row.time_in_location_label,
      timeOutPlace: row.time_out_location_label,
    };
  });
}

async function signEvidence(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const signed = new Map<string, string>();
  if (!unique.length || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return signed;
  }
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(unique, 300);
    if (error || !data) {
      return signed;
    }
    for (const item of data) {
      if (item.path && item.signedUrl) {
        signed.set(item.path, item.signedUrl);
      }
    }
  } catch {
    return signed;
  }
  return signed;
}

function coordinates(
  latitude: number | null,
  longitude: number | null,
  accuracy: number | null,
): string {
  if (latitude == null || longitude == null) {
    return "Not recorded";
  }
  const accuracyText = accuracy == null ? "" : ` (±${Math.round(accuracy)} m)`;
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}${accuracyText}`;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00+08:00`);
  return !Number.isNaN(parsed.valueOf()) && manilaDateKey(parsed) === value;
}
