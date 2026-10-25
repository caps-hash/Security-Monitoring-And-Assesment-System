"use client";

import type { ReactNode } from "react";
import { RoleSidebar, type SidebarNavItem } from "@/components/role-sidebar";

const navigationItems: SidebarNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard/hr",
    icon: "dashboard",
  },
  {
    label: "Personnel",
    href: "/dashboard/hr/personnel",
    icon: "personnel",
  },
  {
    label: "Supervisors",
    href: "/dashboard/hr/supervisors",
    icon: "profile",
  },
  {
    label: "Duty assignment",
    href: "/dashboard/hr/duty",
    icon: "duty",
  },
  {
    label: "Attendance",
    href: "/dashboard/hr/attendance",
    icon: "dtr",
  },
  {
    label: "Assessments",
    href: "/dashboard/hr/assessment",
    icon: "assessment",
  },
];

export function HrSidebar({ children }: { children: ReactNode }) {
  return (
    <RoleSidebar
      items={navigationItems}
      menuId="hr-navigation"
      navigationLabel="HR navigation"
      pagesLabel="HR pages"
    >
      {children}
    </RoleSidebar>
  );
}
