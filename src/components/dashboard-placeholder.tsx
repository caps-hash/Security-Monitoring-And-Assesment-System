import type { ReactNode } from "react";
import type { UserRole } from "@/lib/auth/roles";
import type { AuthenticatedProfile } from "@/lib/auth/profile";

const roleLabels: Record<UserRole, string> = {
  hr: "HR",
  supervisor: "Supervisor",
  employee: "Employee",
};

export function DashboardPlaceholder({
  profile,
  role,
  children,
}: {
  profile: AuthenticatedProfile;
  role: UserRole;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-800">
        {roleLabels[role]} dashboard
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Welcome
            {profile.first_name || profile.last_name
              ? `, ${[profile.first_name, profile.last_name].filter(Boolean).join(" ")}`
              : ""}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{profile.email}</p>
        </div>
        <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          Signed in
        </span>
      </div>
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {children}
      </section>
    </div>
  );
}
