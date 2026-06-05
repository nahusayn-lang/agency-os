export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "waiting_review"
  | "revision_required"
  | "approved"
  | "completed";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  deadline: string | null;
  assigned_by: string;
  assigned_to: string;
  status: TaskStatus;
  proof_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  performed_by: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}

export interface TaskWithUsers extends Task {
  assignee: { id: string; name: string; email: string };
  assigner: { id: string; name: string; email: string };
}

export const TASK_STATUSES: TaskStatus[] = [
  "pending",
  "in_progress",
  "waiting_review",
  "revision_required",
  "approved",
  "completed",
];

export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  waiting_review: "Waiting Review",
  revision_required: "Revision Required",
  approved: "Approved",
  completed: "Completed",
};
