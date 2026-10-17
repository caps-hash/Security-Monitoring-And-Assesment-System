import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
import type {
  AssignmentSummary,
  HRStaffMember,
} from "@/lib/personnel/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Supervisor dashboard",
};

export default async function SupervisorDashboardPage() {
  const profile = await requireRole("supervisor");
  const supabase = await createSupabaseServerClient();
  const { data: assignments, error: assignmentsError } = await supabase
    .from("personnel_assignments")
    .select("*")
    .eq("supervisor_id", profile.id)
    .order("start_date");

  if (assignmentsError) {
    throw new Error(`Unable to load assigned personnel: ${assignmentsError.message}`);
  }

  let staff: HRStaffMember[] = [];
  if (assignments.length) {
    const employeeIds = assignments.map((assignment) => assignment.employee_id);
    const postIds = [...new Set(assignments.map((assignment) => assignment.post_id))];
    const locationIds = [
      ...new Set(assignments.map((assignment) => assignment.duty_location_id)),
    ];
    const shiftIds = [
      ...new Set(assignments.map((assignment) => assignment.duty_shift_id)),
    ];

    const [employeesResult, postsResult, locationsResult, shiftsResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, email, role, first_name, last_name, phone, employee_number, is_active",
          )
          .in("id", employeeIds)
          .order("last_name"),
        supabase.from("posts").select("id, name").in("id", postIds),
        supabase
          .from("duty_locations")
          .select("id, name, address")
          .in("id", locationIds),
        supabase
          .from("duty_shifts")
          .select("id, name, start_time, end_time")
          .in("id", shiftIds),
      ]);

    if (employeesResult.error) {
      throw new Error(`Unable to load assigned employee profiles: ${employeesResult.error.message}`);
    }
    if (postsResult.error) {
      throw new Error(`Unable to load assigned posts: ${postsResult.error.message}`);
    }
    if (locationsResult.error) {
      throw new Error(`Unable to load assigned locations: ${locationsResult.error.message}`);
    }
    if (shiftsResult.error) {
      throw new Error(`Unable to load assigned shifts: ${shiftsResult.error.message}`);
    }

    const employeesById = new Map(
      employeesResult.data.map((employee) => [employee.id, employee]),
    );
    const postsById = new Map(postsResult.data.map((post) => [post.id, post]));
    const locationsById = new Map(
      locationsResult.data.map((location) => [location.id, location]),
    );
    const shiftsById = new Map(
      shiftsResult.data.map((shift) => [shift.id, shift]),
    );

    staff = assignments.flatMap((assignment) => {
      const employee = employeesById.get(assignment.employee_id);
      if (!employee) {
        return [];
      }

      const post = postsById.get(assignment.post_id);
      const location = locationsById.get(assignment.duty_location_id);
      const shift = shiftsById.get(assignment.duty_shift_id);
      const assignmentSummary: AssignmentSummary = {
        supervisor_name:
          `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
        post_name: post?.name ?? "Unavailable",
        location_name: location?.name ?? "Unavailable",
        location_address: location?.address ?? null,
        shift_name: shift?.name ?? "Unavailable",
        shift_start_time: shift?.start_time ?? "",
        shift_end_time: shift?.end_time ?? "",
        start_date: assignment.start_date,
      };

      return [
        {
          profile: employee,
          assignment,
          assignmentSummary,
        },
      ];
    });
  }

  return (
    <DashboardPlaceholder profile={profile} role="supervisor">
      <h2 className="text-lg font-semibold text-slate-900">
        Assigned employees
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        You can view only employees assigned to your supervision.
      </p>
      {staff.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {staff.map(({ profile: employee, assignmentSummary }) => (
            <article
              className="rounded-xl border border-slate-200 p-5"
              key={employee.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {[employee.first_name, employee.last_name]
                      .filter(Boolean)
                      .join(" ") || "Employee"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{employee.email}</p>
                </div>
                <span
                  className={
                    employee.is_active
                      ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                      : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                  }
                >
                  {employee.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee number
                  </dt>
                  <dd className="mt-1 text-slate-900">
                    {employee.employee_number || "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </dt>
                  <dd className="mt-1 text-slate-900">
                    {employee.phone || "Not provided"}
                  </dd>
                </div>
                {assignmentSummary ? (
                  <>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Post
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {assignmentSummary.post_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Duty location
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {assignmentSummary.location_name}
                        {assignmentSummary.location_address
                          ? ` — ${assignmentSummary.location_address}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Duty shift
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {assignmentSummary.shift_name}
                        {assignmentSummary.shift_start_time &&
                        assignmentSummary.shift_end_time
                          ? ` (${assignmentSummary.shift_start_time.slice(0, 5)}–${assignmentSummary.shift_end_time.slice(0, 5)})`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Start date at post
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {assignmentSummary.start_date}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No employees are currently assigned to you.
        </p>
      )}
    </DashboardPlaceholder>
  );
}
