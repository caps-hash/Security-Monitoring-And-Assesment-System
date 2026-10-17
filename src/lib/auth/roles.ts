export const USER_ROLES = ["hr", "supervisor", "employee"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.some((userRole) => userRole === role);
}

export function dashboardPath(role: UserRole): string {
  return `/dashboard/${role}`;
}
