const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export type DutyConfigurationInput = {
  postName: string;
  postDescription: string;
  locationName: string;
  locationAddress: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export function normalizeClockTime(value: string): string {
  return value.trim().slice(0, 5);
}

export function isOvernightShift(startTime: string, endTime: string): boolean {
  const start = normalizeClockTime(startTime);
  const end = normalizeClockTime(endTime);
  return timePattern.test(start) && timePattern.test(end) && end < start;
}

export function formatShiftWindow(startTime: string, endTime: string): string {
  const start = normalizeClockTime(startTime);
  const end = normalizeClockTime(endTime);
  if (!start || !end) {
    return "Unavailable";
  }
  return isOvernightShift(start, end)
    ? `${start}–${end} (overnight)`
    : `${start}–${end}`;
}

export function validateDutyConfigurationInput(
  input: DutyConfigurationInput,
): string | null {
  if (!input.postName.trim()) {
    return "Enter a post name.";
  }
  if (!input.locationName.trim()) {
    return "Enter a duty location name.";
  }
  if (!input.shiftName.trim()) {
    return "Enter a shift name.";
  }
  const startTime = normalizeClockTime(input.startTime);
  const endTime = normalizeClockTime(input.endTime);
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
    return "Enter a valid start time and end time.";
  }
  if (startTime === endTime) {
    return "End time must differ from start time. Use an earlier end time for an overnight shift.";
  }
  return null;
}

export function dutyOptionsAvailable(
  postActive: boolean,
  locationActive: boolean,
  shiftActive: boolean,
): boolean {
  return postActive && locationActive && shiftActive;
}

export function sharedDutyWarning(input: {
  sharedPostUses: number;
  sharedLocationUses: number;
  sharedShiftUses: number;
  assignmentCount: number;
  deactivating: boolean;
}): string | null {
  const shared = [
    input.sharedPostUses > 0
      ? `post (${input.sharedPostUses} other use${input.sharedPostUses === 1 ? "" : "s"})`
      : null,
    input.sharedLocationUses > 0
      ? `duty location (${input.sharedLocationUses} other use${input.sharedLocationUses === 1 ? "" : "s"})`
      : null,
    input.sharedShiftUses > 0
      ? `duty shift (${input.sharedShiftUses} other use${input.sharedShiftUses === 1 ? "" : "s"})`
      : null,
  ].filter((item): item is string => item !== null);

  const parts: string[] = [];
  if (shared.length) {
    parts.push(
      `This ${shared.join(", ")} is shared. Editing it changes the same record for every assignment or configuration that references it.`,
    );
  }
  if (input.assignmentCount > 0) {
    parts.push(
      `${input.assignmentCount} employee assignment${input.assignmentCount === 1 ? "" : "s"} use this post, location, and shift. Editing these records changes what those employees see, but it does not create or replace their assignment.`,
    );
  }
  if (input.deactivating && input.assignmentCount > 0) {
    parts.push(
      "Deactivating it does not delete those assignments, but the options will not be available for a new assignment save.",
    );
  }
  return parts.length ? parts.join(" ") : null;
}
