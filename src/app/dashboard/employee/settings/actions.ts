"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PasswordState = {
  error: string | null;
  success: string | null;
};

const minimumPasswordLength = 6;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function changePassword(
  _previousState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const profile = await getAuthenticatedProfile();
  if (profile.role !== "employee") {
    return {
      error: "Only an employee can change a password from this page.",
      success: null,
    };
  }

  const currentPassword = field(formData, "current_password");
  const nextPassword = field(formData, "new_password");
  const confirmation = field(formData, "confirm_password");

  if (!currentPassword || !nextPassword || !confirmation) {
    return { error: "Enter your current password and a new password.", success: null };
  }
  if (nextPassword.length < minimumPasswordLength) {
    return {
      error: `Use at least ${minimumPasswordLength} characters for the new password.`,
      success: null,
    };
  }
  if (nextPassword !== confirmation) {
    return { error: "The new password and confirmation do not match.", success: null };
  }
  if (nextPassword === currentPassword) {
    return {
      error: "Choose a new password that is different from your current password.",
      success: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });

  if (reauthenticationError) {
    return { error: "The current password is incorrect.", success: null };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: nextPassword,
  });

  if (updateError) {
    return {
      error: "The password could not be updated. Try a different password.",
      success: null,
    };
  }

  revalidatePath("/dashboard/employee/settings");
  return {
    error: null,
    success: "Password updated. Use the new password the next time you sign in.",
  };
}
