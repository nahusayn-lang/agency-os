import type { UserRole } from "@/lib/types/database";

export function canManageTasks(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}
