import type { UserRole } from "@/lib/types/database";

export const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  super_admin: "/dashboard/founder",
  admin: "/dashboard/manager",
  member: "/dashboard/employee",
};

export function getDashboardPathForRole(role: UserRole): string {
  return ROLE_DASHBOARD_PATHS[role];
}

export function getRoleForDashboardPath(pathname: string): UserRole | null {
  if (pathname.startsWith("/dashboard/founder")) {
    return "super_admin";
  }
  if (pathname.startsWith("/dashboard/manager")) {
    return "admin";
  }
  if (pathname.startsWith("/dashboard/employee")) {
    return "member";
  }
  return null;
}

export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    super_admin: "Founder",
    admin: "Manager",
    member: "Employee",
  };
  return names[role];
}
