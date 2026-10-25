import type { ReactNode } from "react";
import { HrSidebar } from "@/components/hr-sidebar";
import { requireRole } from "@/lib/auth/profile";

export default async function HrLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireRole("hr");

  return <HrSidebar>{children}</HrSidebar>;
}
