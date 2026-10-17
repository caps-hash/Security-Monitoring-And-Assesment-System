import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { requireRole } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Employee dashboard",
};

export default async function EmployeeDashboardPage() {
  const profile = await requireRole("employee");
  const supabase = await createSupabaseServerClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("personnel_assignments")
    .select("*")
    .eq("employee_id", profile.id)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(`Unable to load your assignment: ${assignmentError.message}`);
  }

  let postName: string | null = null;
  let locationName: string | null = null;
  let locationAddress: string | null = null;
  let shiftName: string | null = null;
  let shiftStart: string | null = null;
  let shiftEnd: string | null = null;

  if (assignment) {
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
    postName = postResult.data?.name ?? null;
    locationName = locationResult.data?.name ?? null;
    locationAddress = locationResult.data?.address ?? null;
    shiftName = shiftResult.data?.name ?? null;
    shiftStart = shiftResult.data?.start_time ?? null;
    shiftEnd = shiftResult.data?.end_time ?? null;
  }

  return (
    <DashboardPlaceholder profile={profile} role="employee">
      <h2 className="text-lg font-semibold text-slate-900">My profile</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Name
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {[profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
              "Not provided"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Employee number
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {profile.employee_number || "Not provided"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email
          </dt>
          <dd className="mt-1 text-sm text-slate-900">{profile.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Phone
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {profile.phone || "Not provided"}
          </dd>
        </div>
      </dl>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-900">My assignment</h2>
        {assignment ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Post
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {postName ?? "Unavailable"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Duty location
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {locationName ?? "Unavailable"}
                {locationAddress ? ` — ${locationAddress}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Duty shift
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {shiftName ?? "Unavailable"}
                {shiftStart && shiftEnd
                  ? ` (${shiftStart.slice(0, 5)}–${shiftEnd.slice(0, 5)})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Start date at post
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {assignment.start_date}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            HR has not added an assignment yet.
          </p>
        )}
      </div>
    </DashboardPlaceholder>
  );
}
