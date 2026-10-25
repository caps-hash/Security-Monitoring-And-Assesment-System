"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { mustChangePassword } from "@/lib/auth/password-requirement";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { dashboardPath } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RequiredPasswordState = {
  error: string | null;
};

const minimumPasswordLength = 6;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function replaceTemporaryPassword(
  _previousState: RequiredPasswordState,
  formData: FormData,
): Promise<RequiredPasswordState> {
  const profile = await getAuthenticatedProfile();
  const currentPassword = field(formData, "current_password");
  const nextPassword = field(formData, "new_password");
  const confirmation = field(formData, "confirm_password");

  if (!currentPassword || !nextPassword || !confirmation) {
    return { error: "Enter the temporary password and a new password." };
  }
  if (nextPassword.length < minimumPasswordLength) {
    return {
      error: `Use at least ${minimumPasswordLength} characters for the new password.`,
    };
  }
  if (nextPassword !== confirmation) {
    return { error: "The new password and confirmation do not match." };
  }
  if (nextPassword === currentPassword) {
    return {
      error: "Choose a new password that is different from the temporary password.",
    };
  }

  const { url, anonKey } = getSupabaseEnvironment();
  const verificationClient = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data: verification, error: reauthenticationError } =
    await verificationClient.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

  if (
    reauthenticationError ||
    verification.user?.id !== profile.id ||
    !verification.session
  ) {
    return { error: "The temporary password could not be verified for this account." };
  }
  if (!mustChangePassword(verification.user.app_metadata)) {
    redirect(dashboardPath(profile.role));
  }

  const admin = createSupabaseAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
    password: nextPassword,
    app_metadata: {
      ...verification.user.app_metadata,
      must_change_password: false,
    },
  });
  if (updateError) {
    return { error: "The password could not be updated. Try a different password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error: refreshError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: nextPassword,
  });
  if (refreshError) {
    redirect("/login");
  }

  redirect(dashboardPath(profile.role));
}
