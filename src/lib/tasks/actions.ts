"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sendTaskNotification } from "@/lib/services/email-service";
import { notifyUser, notifyUsers } from "@/lib/notifications/notify";
import { isValidStatusTransition } from "@/lib/tasks/transitions";
import type { UserRole } from "@/lib/types/database";
import type { TaskPriority, TaskStatus } from "@/lib/types/tasks";
import { TASK_STATUS_LABELS } from "@/lib/types/tasks";
import { evaluateCannotComplete } from "@/lib/services/strike-fine-engine";

// Central place to invalidate every route that reads from the `tasks`
// table. Any time a task is created, its status changes, or its data is
// edited, call this instead of a one-off revalidatePath("/tasks") — that
// was the root cause of approved/updated tasks appearing to "vanish" from
// /my-tasks and the dashboards until a hard refresh.
function revalidateTaskViews(taskId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/founder");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

async function validateTaskAssignee(
  supabase: ReturnType<typeof createClient>,
  assignerRole: UserRole,
  assignedTo: string
): Promise<string | null> {
  const { data: assignee, error } = await supabase
    .from("users")
    .select("id, role, is_active")
    .eq("id", assignedTo)
    .single();

  if (error || !assignee) return "Assignee not found.";
  if (assignerRole === "super_admin") return null;
  if (assignee.role !== "member" || !assignee.is_active)
    return "Tasks can only be assigned to active team members.";

  return null;
}

async function recordTaskStatusChange(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId: string;
    taskId: string;
    oldStatus: TaskStatus;
    newStatus: TaskStatus;
    action?: string;
  }
) {
  const { error: activityError } = await supabase.from("task_activity").insert({
    task_id: params.taskId,
    performed_by: params.userId,
    action: params.action ?? "status_change",
    old_status: params.oldStatus,
    new_status: params.newStatus,
  });
  if (activityError) throw new Error(activityError.message);

  const { error: auditError } = await supabase.from("audit_log").insert({
    user_id: params.userId,
    action: "task_status_change",
    entity_type: "task",
    entity_id: params.taskId,
    reason: `${params.oldStatus} → ${params.newStatus}`,
  });
  if (auditError) throw new Error(auditError.message);
}

// Helper — notify founders + managers (or founder only, when scoped)
// NOTE: type + referenceId are load-bearing — notification-bell.tsx uses them
// to decide if a notification is directly actionable. Do not drop these.
async function notifyAdmins(
  supabase: ReturnType<typeof createClient>,
  title: string,
  message: string,
  link: string,
  type: string,
  referenceId: string,
  options?: { founderOnly?: boolean }
) {
  const roles = options?.founderOnly ? ["super_admin"] : ["super_admin", "admin"];

  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .in("role", roles)
    .eq("is_active", true);

  if (!admins?.length) return;

  await notifyUsers(
    admins.map((a) => a.id),
    { title, message, link, type, referenceId }
  );
}

export async function createTaskFormAction(formData: FormData): Promise<void> {
  const result = await createTaskAction(formData);
  if (result?.error) {
    redirect(`/tasks?error=${encodeURIComponent(result.error)}`);
  }
}

export async function createTaskAction(formData: FormData) {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return { error: "Only admins can create tasks." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "") as TaskPriority;
  const deadline = String(formData.get("deadline") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "").trim();

  if (!title || !assignedTo) {
    return { error: "Title and assignee are required." };
  }

  const supabase = createClient();

  const assigneeError = await validateTaskAssignee(supabase, profile.role, assignedTo);
  if (assigneeError) return { error: assigneeError };

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: description || null,
      priority: priority || "medium",
      deadline: deadline ? new Date(deadline + "+05:30").toISOString() : null,
      assigned_by: profile.id,
      assigned_to: assignedTo,
      status: "pending",
    })
    .select("id, title")
    .single();

  if (error || !task) {
    return { error: error?.message ?? "Failed to create task." };
  }

  await supabase.from("task_activity").insert({
    task_id: task.id,
    performed_by: profile.id,
    action: "assigned",
    old_status: null,
    new_status: "pending",
  });

  await supabase.from("audit_log").insert({
    user_id: profile.id,
    action: "task_assigned",
    entity_type: "task",
    entity_id: task.id,
  });

  // Notify the assignee — works the same whether it's an employee, a
  // manager, or the founder assigning a task to themselves/another admin.
  await notifyUser({
    userId: assignedTo,
    title: "New Task Assigned",
    message: `${profile.name} has assigned you the task "${task.title}".`,
    link: `/tasks/${task.id}`,
    type: "task_assigned",
    referenceId: task.id,
  });

  const { data: assignee } = await supabase
    .from("users")
    .select("email")
    .eq("id", assignedTo)
    .single();

  if (assignee?.email) {
    await sendTaskNotification({
      to: assignee.email,
      subject: "New task assigned",
      taskTitle: task.title,
      message: `${profile.name} assigned you a new task.`,
    });
  }

  revalidateTaskViews();
  redirect(`/tasks`);
}

export async function updateTaskStatusAction(
  taskId: string,
  newStatus: TaskStatus,
  options?: { forceClose?: boolean; overrideReason?: string; rejectionReason?: string }
) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, status, assigned_to, assigned_by")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) return { error: "Task not found." };

  const oldStatus = task.status as TaskStatus;

  if (!isValidStatusTransition(profile.role, oldStatus, newStatus, { forceClose: options?.forceClose })) {
    return { error: "This status transition is not allowed." };
  }

  if (options?.forceClose) {
    if (profile.role !== "super_admin") return { error: "Only founders can force-close tasks." };
    if (!options.overrideReason?.trim()) return { error: "Override reason is required for force close." };

    const { error: overrideError } = await supabase.from("god_mode_overrides").insert({
      super_admin_id: profile.id,
      action: "force_close_task",
      target_entity: `task:${taskId}`,
      reason: options.overrideReason.trim(),
    });
    if (overrideError) return { error: overrideError.message };

    // Transparency: the affected user should always know when a founder
    // overrides one of their tasks.
    if (task.assigned_to !== profile.id) {
      await notifyUser({
        userId: task.assigned_to,
        title: "Task Force-Closed by Founder",
        message: `${profile.name} force-closed "${task.title}". Reason: ${options.overrideReason.trim()}`,
        link: `/tasks/${taskId}`,
        type: "task_override",
        referenceId: taskId,
      });
    }
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", taskId);
  if (updateError) return { error: updateError.message };

  try {
    await recordTaskStatusChange(supabase, {
      userId: profile.id,
      taskId,
      oldStatus,
      newStatus,
      action: options?.forceClose ? "force_close" : "status_change",
    });
  } catch (err) {
    await supabase.from("tasks").update({ status: oldStatus }).eq("id", taskId);
    return { error: err instanceof Error ? err.message : "Failed to record activity." };
  }

  // Notify whichever party (assigner or assignee) did NOT make this change.
  // "waiting_review" is skipped here — submitTaskAction already notifies all
  // founders/managers about it right after calling this function, so notifying
  // the assigner again here would be a duplicate ping for the same event.
  if (newStatus !== "waiting_review" && !options?.forceClose) {
    const otherParty = profile.id === task.assigned_to ? task.assigned_by : task.assigned_to;

    if (otherParty && otherParty !== profile.id) {
      const statusMessages: Partial<Record<TaskStatus, { title: string; message: string; type: string }>> = {
        approved: {
          title: "Task Approved ✓",
          message: `"${task.title}" has been approved.`,
          type: "task_approved",
        },
        completed: {
          title: "Task Approved ✓",
          message: `"${task.title}" has been approved.`,
          type: "task_approved",
        },
        revision_required: {
          title: "Task Revision Required",
          message: `"${task.title}" requires revision.`,
          type: "task_revision",
        },
        in_progress: {
          title: "Task In Progress",
          message: `Work has started on "${task.title}".`,
          type: "task_status",
        },
      };

      const notice = statusMessages[newStatus] ?? {
        title: "Task Status Updated",
        message: `"${task.title}" status changed to "${TASK_STATUS_LABELS[newStatus]}".`,
        type: "task_status",
      };

      await notifyUser({
        userId: otherParty,
        title: notice.title,
        message: notice.message,
        link: `/tasks/${taskId}`,
        type: notice.type,
        referenceId: taskId,
      });
    }
  }

  // Email
  const { data: users } = await supabase
    .from("users")
    .select("id, email")
    .in("id", [task.assigned_to]);

  for (const user of users ?? []) {
    if (user.email) {
      await sendTaskNotification({
        to: user.email,
        subject: `Task status updated: ${TASK_STATUS_LABELS[newStatus]}`,
        taskTitle: task.title,
        message: `Status changed from ${TASK_STATUS_LABELS[oldStatus]} to ${TASK_STATUS_LABELS[newStatus]}.`,
      });
    }
  }

  revalidateTaskViews(taskId);
  return { success: true };
}

export async function addTaskCommentAction(taskId: string, message: string, options?: { skipNotify?: boolean }) {
  const profile = await requireUserProfile();
  const trimmed = message.trim();
  if (!trimmed) return { error: "Comment cannot be empty." };

  const supabase = createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("title, assigned_to, assigned_by")
    .eq("id", taskId)
    .single();

  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    user_id: profile.id,
    message: trimmed,
  });
  if (error) return { error: error.message };

  await supabase.from("task_activity").insert({
    task_id: taskId,
    performed_by: profile.id,
    action: "comment",
    old_status: null,
    new_status: null,
  });

  if (task && !options?.skipNotify) {
    const otherParty = profile.id === task.assigned_to ? task.assigned_by : task.assigned_to;
    if (otherParty && otherParty !== profile.id) {
      await notifyUser({
        userId: otherParty,
        title: "New Task Comment",
        message: `${profile.name} commented on "${task.title}": ${trimmed.slice(0, 100)}`,
        link: `/tasks/${taskId}`,
        type: "task_comment",
        referenceId: taskId,
      });
    }
  }

  revalidateTaskViews(taskId);
  return { success: true };
}

export async function setTaskProofUrlAction(taskId: string, proofUrl: string) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("status, assigned_to")
    .eq("id", taskId)
    .single();

  if (!task || task.assigned_to !== profile.id)
    return { error: "You are not the assignee of this task." };
  if (task.status !== "in_progress")
    return { error: "Proof can only be uploaded while task is in progress." };

  const { error } = await supabase
    .from("tasks")
    .update({ proof_url: proofUrl })
    .eq("id", taskId);
  if (error) return { error: error.message };

  await supabase.from("task_activity").insert({
    task_id: taskId,
    performed_by: profile.id,
    action: "proof_uploaded",
    old_status: task.status,
    new_status: task.status,
  });

  revalidateTaskViews(taskId);
  return { success: true };
}

export async function submitTaskAction(
  taskId: string,
  completionNote: string,
  optionalLink?: string | null,
  actualCount?: number | null
) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, status, assigned_to, is_mandatory, mandatory_type")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) return { error: "Task not found." };
  if (task.assigned_to !== profile.id) return { error: "Task not found." };

  const noteTrimmed = String(completionNote ?? "").trim();
  if (!noteTrimmed) return { error: "Completion note is required." };

  if (task.is_mandatory) {
    if (actualCount === undefined || actualCount === null || !Number.isFinite(actualCount) || actualCount < 0) {
      return {
        error:
          task.mandatory_type === "cold_calls"
            ? "Enter how many calls you made."
            : "Enter the completed count for this task.",
      };
    }
    const { error: countError } = await supabase
      .from("tasks")
      .update({ mandatory_actual_count: Math.floor(actualCount) })
      .eq("id", taskId);
    if (countError) return { error: countError.message };
  }

  if (optionalLink && String(optionalLink).trim()) {
    const res = await setTaskProofUrlAction(taskId, String(optionalLink).trim());
    if (res?.error) return res;
  }

  const commentRes = await addTaskCommentAction(taskId, noteTrimmed, { skipNotify: true });
  if (commentRes?.error) return commentRes;

  const statusRes = await updateTaskStatusAction(taskId, "waiting_review");
  if (statusRes?.error) return statusRes;

  // Notify founders + managers
  await notifyAdmins(
    supabase,
    "Task submitted for review",
    `${profile.name} has submitted "${task.title}" for review.`,
    `/tasks/${taskId}`,
    "task_review",
    taskId
  );

  revalidateTaskViews(taskId);
  return { success: true };
}

export async function getAssignableMembers() {
  const profile = await requireUserProfile();
  if (profile.role === "member") return [];

  const supabase = createClient();

  if (profile.role === "super_admin") {
    const { data } = await supabase
      .from("users")
      .select("id, name, email, role, is_active")
      .order("name");
    return data ?? [];
  }

  const { data } = await supabase
    .from("users")
    .select("id, name, email, role, is_active")
    .eq("role", "member")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export async function cannotCompleteTaskAction(taskId: string, reason: string) {
  const profile = await requireUserProfile();
  const trimmed = reason.trim();
  if (!trimmed) return { error: "Reason is required." };

  const supabase = createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, status, assigned_to, title")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) return { error: "Task not found." };
  if (task.assigned_to !== profile.id) return { error: "You are not the assignee of this task." };
  if (task.status !== "in_progress") return { error: "Task must be in progress to report cannot complete." };

  // Rule 3: 1 free use/day. 2nd+ use same day -> needs super_admin approval,
  // checkout stays blocked (checked in checkout/route.ts).
  const usage = await evaluateCannotComplete(profile.id, taskId, trimmed);

  const { error: commentError } = await supabase.from("task_comments").insert({
    task_id: taskId,
    user_id: profile.id,
    message: `[Cannot Complete] ${trimmed}`,
  });
  if (commentError) return { error: commentError.message };

  if (usage.status === "auto_accepted") {
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: "revision_required" })
      .eq("id", taskId);
    if (updateError) return { error: updateError.message };

    await supabase.from("task_activity").insert({
      task_id: taskId,
      performed_by: profile.id,
      action: "cannot_complete",
      old_status: "in_progress",
      new_status: "revision_required",
    });
  } else {
    // Pending approval — task deliberately stays in_progress so it doesn't
    // silently look resolved while checkout is blocked.
    await supabase.from("task_activity").insert({
      task_id: taskId,
      performed_by: profile.id,
      action: "cannot_complete_pending_approval",
      old_status: "in_progress",
      new_status: "in_progress",
    });
  }

  await supabase.from("audit_log").insert({
    user_id: profile.id,
    action: "task_cannot_complete",
    entity_type: "task",
    entity_id: taskId,
    reason: trimmed,
  });

  // Notify founders + managers (pending-approval case is founder-only —
  // only the founder can approve/reject a 2nd+ cannot-complete for the day)
  const adminMessage =
    usage.status === "pending_approval"
      ? `${profile.name} could not complete "${task.title}" for the 2nd time today — approval needed. Reason: ${trimmed}`
      : `${profile.name} could not complete "${task.title}". Reason: ${trimmed}`;

  await notifyAdmins(
    supabase,
    usage.status === "pending_approval" ? "Cannot-complete approval needed" : "Task cannot be completed",
    adminMessage,
    `/tasks/${taskId}`,
    usage.status === "pending_approval" ? "cannot_complete_pending" : "task_blocked",
    taskId,
    { founderOnly: usage.status === "pending_approval" }
  );

  revalidateTaskViews(taskId);
  return { success: true, status: usage.status };
}