import { requireRole, type AuthenticatedProfile } from "@/lib/auth/profile";
import type {
  AssignmentSummary,
  HRStaffMember,
  LookupItem,
  StaffProfile,
} from "@/lib/personnel/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HrDashboardData = {
  profile: AuthenticatedProfile;
  staff: HRStaffMember[];
  supervisors: StaffProfile[];
  posts: LookupItem[];
  locations: LookupItem[];
  shifts: LookupItem[];
};

export async function getHrDashboardData(): Promise<HrDashboardData> {
  const profile = await requireRole("hr");
  const supabase = await createSupabaseServerClient();
  const [staffResult, assignmentsResult, postsResult, locationsResult, shiftsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, role, first_name, middle_name, last_name, phone, employee_number, is_active, email_notice_status, sms_notice_status",
        )
        .in("role", ["employee", "supervisor"])
        .order("last_name"),
      supabase.from("personnel_assignments").select("*"),
      supabase.from("posts").select("*").order("name"),
      supabase.from("duty_locations").select("*").order("name"),
      supabase.from("duty_shifts").select("*").order("name"),
    ]);

  if (staffResult.error) {
    throw new Error(`Unable to load staff profiles: ${staffResult.error.message}`);
  }
  if (assignmentsResult.error) {
    throw new Error(
      `Unable to load personnel assignments: ${assignmentsResult.error.message}`,
    );
  }
  if (postsResult.error) {
    throw new Error(`Unable to load posts: ${postsResult.error.message}`);
  }
  if (locationsResult.error) {
    throw new Error(`Unable to load duty locations: ${locationsResult.error.message}`);
  }
  if (shiftsResult.error) {
    throw new Error(`Unable to load duty shifts: ${shiftsResult.error.message}`);
  }

  const supervisors = staffResult.data.filter(
    (staffMember) => staffMember.role === "supervisor" && staffMember.is_active,
  );
  const supervisorNames = new Map(
    supervisors.map((supervisor) => [
      supervisor.id,
      `${supervisor.first_name} ${supervisor.last_name}`.trim() || supervisor.email,
    ]),
  );
  const postsById = new Map(postsResult.data.map((post) => [post.id, post]));
  const locationsById = new Map(
    locationsResult.data.map((location) => [location.id, location]),
  );
  const shiftsById = new Map(shiftsResult.data.map((shift) => [shift.id, shift]));
  const assignmentsByEmployee = new Map(
    assignmentsResult.data.map((assignment) => [assignment.employee_id, assignment]),
  );

  const staff: HRStaffMember[] = staffResult.data.map((staffMember) => {
    const assignment = assignmentsByEmployee.get(staffMember.id) ?? null;
    let assignmentSummary: AssignmentSummary | null = null;

    if (assignment) {
      const post = postsById.get(assignment.post_id);
      const location = locationsById.get(assignment.duty_location_id);
      const shift = shiftsById.get(assignment.duty_shift_id);
      assignmentSummary = {
        supervisor_name: supervisorNames.get(assignment.supervisor_id) ?? "Unavailable",
        post_name: post?.name ?? "Unavailable",
        location_name: location?.name ?? "Unavailable",
        location_address: location?.address ?? null,
        shift_name: shift?.name ?? "Unavailable",
        shift_start_time: shift?.start_time ?? "",
        shift_end_time: shift?.end_time ?? "",
        start_date: assignment.start_date,
      };
    }

    return {
      profile: staffMember,
      assignment,
      assignmentSummary,
    };
  });

  return {
    profile,
    staff,
    supervisors,
    posts: postsResult.data,
    locations: locationsResult.data,
    shifts: shiftsResult.data,
  };
}
