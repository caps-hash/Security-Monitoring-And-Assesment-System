export const MANILA_TIME_ZONE = "Asia/Manila";
export const MAX_EVIDENCE_BYTES = 2_000_000;
export const ATTENDANCE_PAGE_SIZE = 20;

export type GpsPoint = {
  latitude: number;
  longitude: number;
  accuracyM: number;
};

export type Geofence = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type LocationDecision = {
  ok: boolean;
  code:
    | "gps_required"
    | "gps_invalid"
    | "outside_geofence"
    | "inside_geofence"
    | "gps_captured_no_geofence";
  verification: "inside_geofence" | "gps_captured_no_geofence" | null;
  distanceMeters: number | null;
  message: string;
};

export type PunchAction = "time_in" | "time_out";

export type PunchDecision = {
  ok: boolean;
  code: "allowed" | "duplicate_time_in" | "no_active_session";
  message: string;
};

export function manilaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addManilaDays(dateKey: string, days: number): string {
  const utc = new Date(`${dateKey}T00:00:00+08:00`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return manilaDateKey(utc);
}

export function manilaMonthStart(date = new Date()): string {
  return `${manilaDateKey(date).slice(0, 8)}01`;
}

export function manilaRange(
  preset: "today" | "week" | "month",
  now = new Date(),
): { from: string; to: string } {
  const to = manilaDateKey(now);
  if (preset === "today") {
    return { from: to, to };
  }
  if (preset === "week") {
    return { from: addManilaDays(to, -6), to };
  }
  return { from: manilaMonthStart(now), to };
}

export function formatManilaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

export function formatManilaTime(date: Date): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
  return `${time} PHT`;
}

export function formatManilaDateTime(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Invalid time";
  }
  return `${formatManilaDate(date)} ${formatManilaTime(date)}`;
}

export function isOvernight(timeInIso: string, timeOutIso: string | null): boolean {
  if (!timeOutIso) {
    return false;
  }
  const timeIn = new Date(timeInIso);
  const timeOut = new Date(timeOutIso);
  if (Number.isNaN(timeIn.valueOf()) || Number.isNaN(timeOut.valueOf())) {
    return false;
  }
  return manilaDateKey(timeIn) !== manilaDateKey(timeOut);
}

export function durationMinutes(
  timeInIso: string,
  timeOutIso: string | null,
): number | null {
  if (!timeOutIso) {
    return null;
  }
  const start = Date.parse(timeInIso);
  const end = Date.parse(timeOutIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.floor((end - start) / 60000);
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) {
    return "Incomplete";
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest}m`;
  }
  return `${hours}h ${rest}m`;
}

function manilaMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

export function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export type ShiftNote = "early" | "on_time" | "late" | "outside_window";

export function shiftNote(
  timeIn: Date,
  start: string,
  end: string,
): ShiftNote | null {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin == null || endMin == null) {
    return null;
  }
  const punch = manilaMinutes(timeIn);
  const overnight = endMin <= startMin;
  if (!overnight) {
    if (punch < startMin) {
      return "early";
    }
    if (punch > endMin) {
      return "outside_window";
    }
    return punch === startMin ? "on_time" : "late";
  }
  const within = punch >= startMin || punch <= endMin;
  if (!within) {
    return "outside_window";
  }
  const delta = punch >= startMin ? punch - startMin : punch + 24 * 60 - startMin;
  return delta === 0 ? "on_time" : "late";
}

export function lateMinutes(timeIn: Date, start: string, end: string): number | null {
  if (shiftNote(timeIn, start, end) !== "late") {
    return null;
  }
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin == null || endMin == null) {
    return null;
  }
  const punch = manilaMinutes(timeIn);
  if (endMin > startMin) {
    return punch - startMin;
  }
  return punch >= startMin ? punch - startMin : punch + 24 * 60 - startMin;
}

export function shiftEndPassed(
  attendanceDate: string,
  start: string,
  end: string,
  now: Date,
): boolean | null {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin == null || endMin == null || !/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
    return null;
  }
  const endDate = endMin <= startMin ? addManilaDays(attendanceDate, 1) : attendanceDate;
  const clock = end.length === 5 ? `${end}:00` : end;
  const endAt = new Date(`${endDate}T${clock}+08:00`);
  if (Number.isNaN(endAt.valueOf())) {
    return null;
  }
  return now.getTime() >= endAt.getTime();
}

export function parseGps(
  latitudeValue: string,
  longitudeValue: string,
  accuracyValue: string,
): GpsPoint | null {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  const accuracyM = Number(accuracyValue);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return null;
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }
  if (!Number.isFinite(accuracyM) || accuracyM <= 0 || accuracyM > 100000) {
    return null;
  }
  return { latitude, longitude, accuracyM };
}

export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function configuredGeofence(input: {
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
}): Geofence | null {
  const { latitude, longitude, radiusMeters } = input;
  if (
    latitude == null ||
    longitude == null ||
    radiusMeters == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0
  ) {
    return null;
  }
  return { latitude, longitude, radiusMeters };
}

export function evaluateLocation(
  gps: GpsPoint | null,
  geofence: Geofence | null,
): LocationDecision {
  if (!gps) {
    return {
      ok: false,
      code: "gps_required",
      verification: null,
      distanceMeters: null,
      message:
        "GPS is required for attendance. Enable location permission and retry. Nothing was recorded.",
    };
  }
  if (!geofence) {
    return {
      ok: true,
      code: "gps_captured_no_geofence",
      verification: "gps_captured_no_geofence",
      distanceMeters: null,
      message:
        "GPS was captured. This duty location has no configured geofence, so distance was not used to reject the record.",
    };
  }
  const distance = distanceMeters(
    gps.latitude,
    gps.longitude,
    geofence.latitude,
    geofence.longitude,
  );
  if (distance > geofence.radiusMeters) {
    return {
      ok: false,
      code: "outside_geofence",
      verification: null,
      distanceMeters: distance,
      message: `You are about ${Math.round(distance)} m from the duty location, outside the configured ${geofence.radiusMeters} m radius. Attendance was not recorded.`,
    };
  }
  return {
    ok: true,
    code: "inside_geofence",
    verification: "inside_geofence",
    distanceMeters: distance,
    message: `Location is inside the configured duty radius (${Math.round(distance)} m).`,
  };
}

export function decidePunch(
  action: PunchAction,
  hasOpenSession: boolean,
  hasSameDateRecord: boolean,
): PunchDecision {
  if (action === "time_in") {
    if (hasOpenSession || hasSameDateRecord) {
      return {
        ok: false,
        code: "duplicate_time_in",
        message: hasOpenSession
          ? "Time In is already open. Time Out before starting another record."
          : "A Time In already exists for this Philippine date.",
      };
    }
    return { ok: true, code: "allowed", message: "Time In is allowed." };
  }
  if (!hasOpenSession) {
    return {
      ok: false,
      code: "no_active_session",
      message: "Time Out requires an open Time In. Nothing was recorded.",
    };
  }
  return { ok: true, code: "allowed", message: "Time Out is allowed." };
}

export function parseGeofenceInput(
  latitudeValue: string,
  longitudeValue: string,
  radiusValue: string,
): { ok: true; value: Geofence | null } | { ok: false; error: string } {
  const latitudeText = latitudeValue.trim();
  const longitudeText = longitudeValue.trim();
  const radiusText = radiusValue.trim();
  if (!latitudeText && !longitudeText && !radiusText) {
    return { ok: true, value: null };
  }
  if (!latitudeText || !longitudeText || !radiusText) {
    return {
      ok: false,
      error:
        "Enter latitude, longitude, and radius together, or leave all three blank. No default radius is applied.",
    };
  }
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  const radiusMeters = Number(radiusText);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, error: "Latitude must be between -90 and 90." };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: "Longitude must be between -180 and 180." };
  }
  if (!Number.isInteger(radiusMeters) || radiusMeters <= 0 || radiusMeters > 100000) {
    return {
      ok: false,
      error: "Geofence radius must be a whole number of meters greater than 0.",
    };
  }
  return { ok: true, value: { latitude, longitude, radiusMeters } };
}

export function sniffJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function evidencePath(
  employeeId: string,
  recordId: string,
  action: PunchAction,
): string {
  return `${employeeId}/${recordId}/${action === "time_in" ? "time-in" : "time-out"}.jpg`;
}

export function verificationLabel(value: string | null): string {
  switch (value) {
    case "inside_geofence":
      return "Inside configured radius";
    case "gps_captured_no_geofence":
      return "GPS captured, no geofence configured";
    case "outside_geofence":
      return "Outside configured radius";
    default:
      return "Not recorded";
  }
}

export function shiftNoteLabel(value: string | null): string {
  switch (value) {
    case "early":
      return "Before shift";
    case "on_time":
      return "At shift start";
    case "late":
      return "After shift start";
    case "outside_window":
      return "Outside shift window";
    default:
      return "Not compared";
  }
}
