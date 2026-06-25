import type { TaskStatus } from "@/lib/types/tasks";
import type { UserRole } from "@/lib/types/database";

const MEMBER_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  pending: ["in_progress"],
  in_progress: ["waiting_review", "paused"],
  paused: ["in_progress"],
  revision_required: ["in_progress"],
};

const ADMIN_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  pending: ["in_progress"],
  in_progress: ["waiting_review"],
  paused: ["in_progress"],
  revision_required: ["in_progress"],
  waiting_review: ["revision_required", "approved"],
  approved: ["completed"],
};

export function isValidStatusTransition(
  role: UserRole,
  from: TaskStatus,
  to: TaskStatus,
  options?: { forceClose?: boolean }
): boolean {
  if (from === to) {
    return false;
  }

  if (options?.forceClose) {
    return role === "super_admin" && to === "completed";
  }

  if (role === "member") {
    return MEMBER_TRANSITIONS[from]?.includes(to) ?? false;
  }

  if (role === "admin" || role === "super_admin") {
    return ADMIN_TRANSITIONS[from]?.includes(to) ?? false;
  }

  return false;
}

export function getAllowedTransitions(
  role: UserRole,
  currentStatus: TaskStatus
): TaskStatus[] {
  if (role === "member") {
    return MEMBER_TRANSITIONS[currentStatus] ?? [];
  }
  return ADMIN_TRANSITIONS[currentStatus] ?? [];
}