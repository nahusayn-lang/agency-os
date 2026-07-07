"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sendTaskNotification } from "@/lib/services/email-service";
import { isValidStatusTransition } from "@/lib/tasks/transitions";
import type { UserRole } from "@/lib/types/database";
import type { TaskPriority, TaskStatus } from "@/lib/types/tasks";
import { TASK_STATUS_LABELS } from "@/lib/types/tasks";
import { evaluateCannotComplete } from "@/lib/services/strike-fine-engine";

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

// Helper — notify all founders + managers
// NOTE: type + referenceId are load-bearing — notification-bell.tsx uses them
// to decide if a notification is directly actionable. Do not drop these.
async function notifyAdmins(
  supabase: ReturnType<typeof createClient>,
  title: string,
  message: string,
  link: string,
  type: string,
  referenceId: string
) {
  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .in("role", ["super_admin", "admin"])
    .eq("is_active", true);

  if (!admins?.length) return;

  await supabase.from("notifications").insert(
    admins.map((a) => ({
      user_id: a.id,
      title,
      message,
      link,
      type,
      reference_id: referenceId,
    }))
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

  // Notify employee
  await supabase.from("notifications").insert({
    user_id: assignedTo,
    title: "New task assigned",
    message: `${profile.name} ne tumhe "${task.title}" task assign ki hai.`,
    link: `/tasks/${task.id}`,
    type: "task_assigned",
    reference_id: task.id,
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

  revalidatePath("/tasks");
  redirect(`/tasks/${task.id}`);
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
    .select("id, title, status, assigned_to")
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

  // Notify employee on approval or revision
  if (newStatus === "approved" || newStatus === "completed") {
    await supabase.from("notifications").insert({
      user_id: task.assigned_to,
      title: "Task approved ✓",
      message: `Tumhari "${task.title}" task approve ho gayi.`,
      link: `/tasks/${taskId}`,
      type: "task_approved",
      reference_id: taskId,
    });
  }

  if (newStatus === "revision_required") {
    await supabase.from("notifications").insert({
      user_id: task.assigned_to,
      title: "Task revision required",
      message: `"${task.title}" mein revision chahiye. Admin ka message dekho.`,
      link: `/tasks/${taskId}`,
      type: "task_revision",
      reference_id: taskId,
    });
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

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function addTaskCommentAction(taskId: string, message: string) {
  const profile = await requireUserProfile();
  const trimmed = message.trim();
  if (!trimmed) return { error: "Comment cannot be empty." };

  const supabase = createClient();

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

  revalidatePath(`/tasks/${taskId}`);
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

  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function submitTaskAction(
  taskId: string,
  completionNote: string,
  optionalLink?: string | null
) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, status, assigned_to")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) return { error: "Task not found." };
  if (task.assigned_to !== profile.id) return { error: "Task not found." };

  const noteTrimmed = String(completionNote ?? "").trim();
  if (!noteTrimmed) return { error: "Completion note is required." };

  if (optionalLink && String(optionalLink).trim()) {
    const res = await setTaskProofUrlAction(taskId, String(optionalLink).trim());
    if (res?.error) return res;
  }

  const commentRes = await addTaskCommentAction(taskId, noteTrimmed);
  if (commentRes?.error) return commentRes;

  const statusRes = await updateTaskStatusAction(taskId, "waiting_review");
  if (statusRes?.error) return statusRes;

  // Notify founders + managers
  await notifyAdmins(
    supabase,
    "Task submitted for review",
    `${profile.name} ne "${task.title}" task submit ki — review karo.`,
    `/tasks/${taskId}`,
    "task_review",
    taskId
  );

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
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

  // Notify founders + managers
  const adminMessage =
    usage.status === "pending_approval"
      ? `${profile.name} ne aaj 2nd baar "${task.title}" complete nahi kar saka — approval chahiye. Reason: ${trimmed}`
      : `${profile.name} ne "${task.title}" complete nahi kar saka. Reason: ${trimmed}`;

  await notifyAdmins(
    supabase,
    usage.status === "pending_approval" ? "Cannot-complete approval needed" : "Task cannot be completed",
    adminMessage,
    `/tasks/${taskId}`,
    usage.status === "pending_approval" ? "cannot_complete_pending" : "task_blocked",
    taskId
  );

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return { success: true, status: usage.status };
}