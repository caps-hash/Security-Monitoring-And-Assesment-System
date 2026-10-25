import type { ReactNode } from "react";
import { SupervisorSidebar } from "@/components/supervisor-sidebar";
import { requireRole } from "@/lib/auth/profile";

export default async function SupervisorLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireRole("supervisor");

  return <SupervisorSidebar>{children}</SupervisorSidebar>;
}
