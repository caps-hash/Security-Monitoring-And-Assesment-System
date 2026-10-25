import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";
import { EmployeeAssignmentDetails } from "@/components/employee-assignment-details";
import { requireRole } from "@/lib/auth/profile";
import { getEmployeeAssignment } from "@/lib/personnel/employee-assignment";

export const metadata: Metadata = {
  title: "My profile",
};

export default async function EmployeeProfilePage() {
  const profile = await requireRole("employee");
  const assignment = await getEmployeeAssignment(profile.id);
  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "Not provided";

  return (
    <DashboardPlaceholder profile={profile} role="employee">
      <section aria-labelledby="profile-heading">
        <h2 className="text-lg font-semibold text-slate-900" id="profile-heading">
          My profile
        </h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Full name
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{fullName}</dd>
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
              Email address
            </dt>
            <dd className="mt-1 break-all text-sm text-slate-900">
              {profile.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contact number
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {profile.phone || "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account status
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {profile.is_active ? "Active" : "Inactive"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <EmployeeAssignmentDetails assignment={assignment} />
      </div>
      <p className="mt-6 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
        Profile and assignment information are managed by HR. Contact HR if
        anything needs to be corrected.
      </p>
    </DashboardPlaceholder>
  );
}
