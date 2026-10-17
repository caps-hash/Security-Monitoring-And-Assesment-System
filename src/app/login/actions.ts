"use server";

import { redirect } from "next/navigation";
import { dashboardPath, isUserRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

export async function signIn(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return { error: "Enter your email address and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (signInError) {
    return { error: "Unable to sign in with those credentials." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error(
      `Sign-in succeeded but the Supabase session could not be verified${userError ? `: ${userError.message}` : "."}`,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load the account role: ${profileError.message}`);
  }
  if (!profile || !isUserRole(profile.role)) {
    throw new Error(
      "This account has no valid role profile. Run supabase/schema.sql and assign a supported role.",
    );
  }
  if (!profile.is_active) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error(
        `Unable to end the inactive account session: ${signOutError.message}`,
      );
    }
    return {
      error: "This account is inactive. Contact HR for assistance.",
    };
  }

  redirect(dashboardPath(profile.role));
}
