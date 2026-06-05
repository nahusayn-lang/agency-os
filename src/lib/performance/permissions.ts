import type { UserProfile, UserRole } from "@/lib/types/database";

export function canOverridePerformanceScore(
  viewer: UserProfile,
  target: { id: string; role: UserRole }
): boolean {
  if (viewer.id === target.id) {
    return false;
  }

  if (viewer.role === "admin") {
    return target.role === "member";
  }

  if (viewer.role === "super_admin") {
    return target.role === "member" || target.role === "admin";
  }

  return false;
}

export function canViewTeamProfile(
  viewer: UserProfile,
  targetUserId: string
): boolean {
  if (viewer.id === targetUserId) {
    return true;
  }
  return viewer.role === "admin" || viewer.role === "super_admin";
}
