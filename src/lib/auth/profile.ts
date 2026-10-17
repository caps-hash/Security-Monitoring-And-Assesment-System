import { redirect } from "next/navigation";
import { dashboardPath, isUserRole, type UserRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedProfile = {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  employee_number: string | null;
  is_active: boolean;
};

export async function getAuthenticatedProfile(): Promise<AuthenticatedProfile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Unable to verify the current Supabase session: ${error.message}`);
  }
  if (!data.user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, email, role, first_name, last_name, phone, employee_number, is_active",
    )
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load the signed-in user's profile: ${profileError.message}`);
  }
  if (!profile) {
    throw new Error(
      "This account has no profile. Run supabase/schema.sql and create its profile before signing in.",
    );
  }
  if (!isUserRole(profile.role)) {
    throw new Error(`The account has an unsupported role: ${profile.role}`);
  }
  if (!profile.is_active) {
    redirect("/login?inactive=1");
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    first_name: profile.first_name,
    last_name: profile.last_name,
    phone: profile.phone,
    employee_number: profile.employee_number,
    is_active: profile.is_active,
  };
}

export async function requireRole(role: UserRole): Promise<AuthenticatedProfile> {
  const profile = await getAuthenticatedProfile();

  if (profile.role !== role) {
    redirect(dashboardPath(profile.role));
  }

  return profile;
}
