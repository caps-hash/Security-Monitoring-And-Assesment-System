"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { resolveLocationLabel } from "@/lib/attendance/geocode";
import {
  MAX_EVIDENCE_BYTES,
  configuredGeofence,
  decidePunch,
  evaluateLocation,
  evidencePath,
  manilaDateKey,
  parseGps,
  shiftNote,
  sniffJpeg,
} from "@/lib/attendance/policy";
import { isMissingAttendanceSchema } from "@/lib/attendance/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "attendance-evidence";

export type AttendanceActionResult = {
  ok: boolean;
  code: string;
  message: string;
};

export async function previewLocationLabel(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "employee") {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return resolveLocationLabel(latitude, longitude);
}

export async function recordAttendance(
  formData: FormData,
): Promise<AttendanceActionResult> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "employee") {
    return failed("forbidden", "Only an employee can record attendance.");
  }

  const action = formData.get("action");
  if (action !== "time_in" && action !== "time_out") {
    return failed("invalid", "Choose Time In or Time Out.");
  }

  const gps = parseGps(
    field(formData, "latitude"),
    field(formData, "longitude"),
    field(formData, "accuracy"),
  );
  const location = evaluateLocation(gps, null);
  if (!gps || !location.ok) {
    return failed("gps_required", location.message);
  }

  const evidence = await readEvidence(formData);
  if ("error" in evidence) {
    return failed("photo_invalid", evidence.error);
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return failed(
      "config",
      "Attendance cannot be saved until SUPABASE_SERVICE_ROLE_KEY is set on the server.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("personnel_assignments")
    .select("id, employee_id, post_id, duty_location_id, duty_shift_id, start_date")
    .eq("employee_id", profile.id)
    .maybeSingle();
  if (assignmentError) {
    return failed("assignment", "Your assignment could not be verified. Nothing was recorded.");
  }
  if (!assignment) {
    return failed(
      "missing_assignment",
      "You have no duty assignment. Attendance is blocked until HR assigns a post, location, and shift.",
    );
  }

  const today = manilaDateKey(new Date());
  if (action === "time_in" && today < assignment.start_date) {
    return failed(
      "before_start",
      "Attendance cannot be recorded before the assignment start date.",
    );
  }

  const { data: openRecord, error: openError } = await supabase
    .from("attendance_records")
    .select("id, duty_location_id, duty_shift_id, attendance_date, status")
    .eq("employee_id", profile.id)
    .eq("status", "open")
    .maybeSingle();
  if (openError) {
    return failed("schema", schemaOrRetry(openError.message));
  }

  const { data: sameDate, error: sameDateError } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("employee_id", profile.id)
    .eq("attendance_date", today)
    .maybeSingle();
  if (sameDateError) {
    return failed("schema", schemaOrRetry(sameDateError.message));
  }

  const decision = decidePunch(action, Boolean(openRecord), Boolean(sameDate));
  if (!decision.ok) {
    return failed(decision.code, decision.message);
  }

  const locationId =
    action === "time_out" && openRecord
      ? openRecord.duty_location_id
      : assignment.duty_location_id;
  const shiftId =
    action === "time_out" && openRecord ? openRecord.duty_shift_id : assignment.duty_shift_id;

  const [locationResult, shiftResult] = await Promise.all([
    supabase
      .from("duty_locations")
      .select("latitude, longitude, geofence_radius_meters")
      .eq("id", locationId)
      .maybeSingle(),
    supabase
      .from("duty_shifts")
      .select("start_time, end_time")
      .eq("id", shiftId)
      .maybeSingle(),
  ]);
  if (locationResult.error || shiftResult.error || !shiftResult.data) {
    return failed("assignment", "Duty location or shift could not be verified. Nothing was recorded.");
  }

  const geofence = configuredGeofence({
    latitude: locationResult.data?.latitude,
    longitude: locationResult.data?.longitude,
    radiusMeters: locationResult.data?.geofence_radius_meters,
  });
  const verified = evaluateLocation(gps, geofence);
  if (!verified.ok || !verified.verification) {
    return failed(verified.code, verified.message);
  }

  const place = await resolveLocationLabel(gps.latitude, gps.longitude);
  const captured = captureTime(field(formData, "capturedAt"));
  const recordId = action === "time_out" && openRecord ? openRecord.id : randomUUID();
  const path = evidencePath(profile.id, recordId, action);
  const uploaded = await admin.storage.from(BUCKET).upload(path, evidence.bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploaded.error) {
    return failed(
      "upload_failed",
      "The attendance photo could not be stored. Attendance was not recorded. Retry the capture.",
    );
  }

  if (action === "time_in") {
    const note = shiftNote(
      new Date(),
      shiftResult.data.start_time,
      shiftResult.data.end_time,
    );
    const { data, error } = await admin
      .from("attendance_records")
      .insert({
        id: recordId,
        employee_id: profile.id,
        assignment_id: assignment.id,
        post_id: assignment.post_id,
        duty_location_id: assignment.duty_location_id,
        duty_shift_id: assignment.duty_shift_id,
        time_in_captured_at: captured,
        time_in_latitude: gps.latitude,
        time_in_longitude: gps.longitude,
        time_in_accuracy_m: gps.accuracyM,
        time_in_location_label: place,
        time_in_photo_path: path,
        time_in_verification: verified.verification,
        shift_note: note,
        status: "open",
        time_in_at: new Date().toISOString(),
        attendance_date: today,
      })
      .select("time_in_at")
      .single();

    if (error || !data) {
      await admin.storage.from(BUCKET).remove([path]);
      return failed("database_failed", schemaOrRetry(error?.message ?? "insert failed"));
    }

    revalidateAttendance();
    return {
      ok: true,
      code: "time_in_saved",
      message: `Time In saved at ${formatServerTime(data.time_in_at)}. ${verified.message}`,
    };
  }

  const { data, error } = await admin
    .from("attendance_records")
    .update({
      time_out_at: new Date().toISOString(),
      time_out_captured_at: captured,
      time_out_latitude: gps.latitude,
      time_out_longitude: gps.longitude,
      time_out_accuracy_m: gps.accuracyM,
      time_out_location_label: place,
      time_out_photo_path: path,
      time_out_verification: verified.verification,
      status: "completed",
    })
    .eq("id", recordId)
    .eq("employee_id", profile.id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    await admin.storage.from(BUCKET).remove([path]);
    return failed(
      "database_failed",
      schemaOrRetry(error?.message ?? "The open attendance session was no longer available."),
    );
  }

  revalidateAttendance();
  return {
    ok: true,
    code: "time_out_saved",
    message: `Time Out saved. ${verified.message}`,
  };
}

function revalidateAttendance() {
  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/employee/dtr");
  revalidatePath("/dashboard/hr/attendance");
  revalidatePath("/dashboard/supervisor/attendance");
}

async function readEvidence(
  formData: FormData,
): Promise<{ bytes: Buffer } | { error: string }> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Capture an attendance photo before submitting." };
  }
  if (photo.size > MAX_EVIDENCE_BYTES) {
    return { error: "The attendance photo is too large. Retake it and submit again." };
  }
  const bytes = Buffer.from(await photo.arrayBuffer());
  if (!sniffJpeg(bytes)) {
    return { error: "Attendance evidence must be a JPEG photograph." };
  }
  return { bytes };
}

function captureTime(value: string): string | null {
  if (!value || value.length > 40) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function schemaOrRetry(message: string): string {
  if (isMissingAttendanceSchema(message)) {
    return "Attendance storage is not ready. Re-run supabase/schema.sql in the Supabase SQL Editor.";
  }
  if (/duplicate key|attendance_one_/i.test(message)) {
    return "This attendance action was already recorded. Refresh the page before trying again.";
  }
  if (/Completed attendance cannot be modified/i.test(message)) {
    return "This session was already closed. Refresh the page. Nothing new was saved.";
  }
  return "Attendance could not be saved. It was not marked successful. Retry when the connection is available.";
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function failed(code: string, message: string): AttendanceActionResult {
  return { ok: false, code, message };
}

function formatServerTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value)) + " PHT";
}
