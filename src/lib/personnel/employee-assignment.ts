import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EmployeeAssignmentDetails = {
  postName: string;
  locationName: string;
  locationAddress: string | null;
  shiftName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  startDate: string;
};

export async function getEmployeeAssignment(
  employeeId: string,
): Promise<EmployeeAssignmentDetails | null> {
  const supabase = await createSupabaseServerClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("personnel_assignments")
    .select("post_id, duty_location_id, duty_shift_id, start_date")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(`Unable to load your assignment: ${assignmentError.message}`);
  }
  if (!assignment) {
    return null;
  }

  const [postResult, locationResult, shiftResult] = await Promise.all([
    supabase
      .from("posts")
      .select("name")
      .eq("id", assignment.post_id)
      .maybeSingle(),
    supabase
      .from("duty_locations")
      .select("name, address")
      .eq("id", assignment.duty_location_id)
      .maybeSingle(),
    supabase
      .from("duty_shifts")
      .select("name, start_time, end_time")
      .eq("id", assignment.duty_shift_id)
      .maybeSingle(),
  ]);

  if (postResult.error) {
    throw new Error(`Unable to load your assigned post: ${postResult.error.message}`);
  }
  if (locationResult.error) {
    throw new Error(`Unable to load your duty location: ${locationResult.error.message}`);
  }
  if (shiftResult.error) {
    throw new Error(`Unable to load your duty shift: ${shiftResult.error.message}`);
  }

  return {
    postName: postResult.data?.name ?? "Unavailable",
    locationName: locationResult.data?.name ?? "Unavailable",
    locationAddress: locationResult.data?.address ?? null,
    shiftName: shiftResult.data?.name ?? "Unavailable",
    shiftStart: shiftResult.data?.start_time ?? null,
    shiftEnd: shiftResult.data?.end_time ?? null,
    startDate: assignment.start_date,
  };
}
