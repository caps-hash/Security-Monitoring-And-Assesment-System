"use client";

import type { ReactNode } from "react";
import { RoleSidebar, type SidebarNavItem } from "@/components/role-sidebar";

const navigationItems: SidebarNavItem[] = [
  {
    label: "Assigned personnel",
    href: "/dashboard/supervisor",
    icon: "personnel",
  },
  {
    label: "Attendance",
    href: "/dashboard/supervisor/attendance",
    icon: "dtr",
  },
  {
    label: "Assessments",
    href: "/dashboard/supervisor/assessment",
    icon: "assessment",
  },
];

export function SupervisorSidebar({ children }: { children: ReactNode }) {
  return (
    <RoleSidebar
      items={navigationItems}
      menuId="supervisor-navigation"
      navigationLabel="Supervisor navigation"
      pagesLabel="Supervisor pages"
    >
      {children}
    </RoleSidebar>
  );
}
