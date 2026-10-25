import type { ReactNode } from "react";
import { EmployeeSidebar } from "@/components/employee-sidebar";
import { requireRole } from "@/lib/auth/profile";

export default async function EmployeeLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireRole("employee");

  return <EmployeeSidebar>{children}</EmployeeSidebar>;
}
