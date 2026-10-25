import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RequiredPasswordForm } from "@/app/account/password/password-form";
import { mustChangePassword } from "@/lib/auth/password-requirement";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { dashboardPath } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Change temporary password",
};

export default async function RequiredPasswordPage() {
  const profile = await getAuthenticatedProfile();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !mustChangePassword(data.user.app_metadata)) {
    redirect(dashboardPath(profile.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-800">
          Global Ground Force
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
          Change your temporary password
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This account must use a new password before opening the dashboard. The
          temporary password is not shown again after this step.
        </p>
        <RequiredPasswordForm />
      </section>
    </main>
  );
}
