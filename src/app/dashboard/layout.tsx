import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { mustChangePassword } from "@/lib/auth/password-requirement";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user && mustChangePassword(data.user.app_metadata)) {
    redirect("/account/password");
  }

  return children;
}
