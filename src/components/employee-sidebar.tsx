"use client";

import type { ReactNode } from "react";
import { RoleSidebar, type SidebarNavItem } from "@/components/role-sidebar";

const navigationItems: SidebarNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard/employee",
    icon: "dashboard",
  },
  {
    label: "My Profile",
    href: "/dashboard/employee/profile",
    icon: "profile",
  },
  {
    label: "My Assignment",
    href: "/dashboard/employee/assignment",
    icon: "assignment",
  },
  {
    label: "Assessment Status",
    href: "/dashboard/employee/assessment",
    icon: "assessment",
  },
  {
    label: "My DTR",
    href: "/dashboard/employee/dtr",
    icon: "dtr",
  },
  {
    label: "Account Settings",
    href: "/dashboard/employee/settings",
    icon: "settings",
  },
  {
    label: "Change Password",
    href: "/dashboard/employee/settings#change-password",
    icon: "password",
  },
];

export function EmployeeSidebar({ children }: { children: ReactNode }) {
  return (
    <RoleSidebar
      items={navigationItems}
      menuId="employee-navigation"
      navigationLabel="Employee navigation"
      pagesLabel="Employee pages"
    >
      {children}
    </RoleSidebar>
  );
}
