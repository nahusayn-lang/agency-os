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

  if (error || !assignee) {
    return "Assignee not found.";
  }

  if (assignerRole === "super_admin") {
    return null;
  }

  if (assignee.role !== "member" || !assignee.is_active) {
    return "Tasks can only be assigned to active team members.";
  }

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

  if (activityError) {
    throw new Error(activityError.message);
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    user_id: params.userId,
    action: "task_status_change",
    entity_type: "task",
    entity_id: params.taskId,
    reason: `${params.oldStatus} → ${params.newStatus}`,
  });

  if (auditError) {
    throw new Error(auditError.message);
  }
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
  const estimatedHoursRaw = String(formData.get("estimated_hours") ?? "").trim();
  const estimated_hours = estimatedHoursRaw ? Number(estimatedHoursRaw) : null;

  if (!title || !assignedTo) {
    return { error: "Title and assignee are required." };
  }

  const supabase = createClient();

  const assigneeError = await validateTaskAssignee(
    supabase,
    profile.role,
    assignedTo
  );
  if (assigneeError) {
    return { error: assigneeError };
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: description || null,
      priority: priority || "medium",
      deadline: deadline ? new Date(deadline).toISOString() : null,
      estimated_hours,
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

  if (fetchError || !task) {
    return { error: "Task not found." };
  }

  const oldStatus = task.status as TaskStatus;

  if (
    !isValidStatusTransition(profile.role, oldStatus, newStatus, {
      forceClose: options?.forceClose,
    })
  ) {
    return { error: "This status transition is not allowed." };
  }

  // If moving a task to in_progress, ensure only one active task exists by pausing others
  if (newStatus === "in_progress") {
    try {
      const { data: otherTasks } = await supabase
        .from("tasks")
        .select("id, status")
        .eq("assigned_to", profile.id)
        .eq("status", "in_progress")
        .neq("id", taskId);

      for (const ot of (otherTasks ?? [])) {
        await supabase.from("tasks").update({ status: "paused" }).eq("id", ot.id);
        await supabase.from("task_activity").insert({
          task_id: ot.id,
          performed_by: profile.id,
          action: "auto_paused",
          old_status: "in_progress",
          new_status: "paused",
        });
        await supabase.from("audit_log").insert({
          user_id: profile.id,
          action: "auto_pause_other_task",
          entity_type: "task",
          entity_id: ot.id,
          reason: `Auto-paused due to starting task ${taskId}`,
        });
      }
    } catch (e) {
      console.error("Failed to auto-pause other tasks:", e);
    }
  }

  if (options?.forceClose) {
    if (profile.role !== "super_admin") {
      return { error: "Only founders can force-close tasks." };
    }
    if (!options.overrideReason?.trim()) {
      return { error: "Override reason is required for force close." };
    }

    const { error: overrideError } = await supabase
      .from("god_mode_overrides")
      .insert({
        super_admin_id: profile.id,
        action: "force_close_task",
        target_entity: `task:${taskId}`,
        reason: options.overrideReason.trim(),
      });

    if (overrideError) {
      return { error: overrideError.message };
    }
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", taskId);

  if (updateError) {
    return { error: updateError.message };
  }

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
    return {
      error: err instanceof Error ? err.message : "Failed to record activity.",
    };
  }

  // If founder rejected a submission, increment strike for assignee and record reason
  if (
    profile.role === "super_admin" &&
    oldStatus === "waiting_review" &&
    newStatus === "revision_required"
  ) {
    const reason = options?.rejectionReason?.trim() ?? null;
    if (!reason) {
      // rejection requires a reason
      return { error: "Rejection reason is required." };
    }

    // increment strikes for the assignee (fallback approach)
    // read current strikes
    const { data: userRow } = await supabase
      .from("users")
      .select("id, strikes")
      .eq("id", task.assigned_to)
      .single();

    const currentStrikes = (userRow?.strikes as number) ?? 0;
    await supabase
      .from("users")
      .update({ strikes: currentStrikes + 1 })
      .eq("id", task.assigned_to);

    // record audit_log with rejection reason
    await supabase.from("audit_log").insert({
      user_id: profile.id,
      action: "task_rejected",
      entity_type: "task",
      entity_id: taskId,
      reason,
    });
  }

  const notifyIds = new Set([task.assigned_to]);
  const { data: users } = await supabase
    .from("users")
    .select("id, email")
    .in("id", Array.from(notifyIds));

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

  if (!trimmed) {
    return { error: "Comment cannot be empty." };
  }

  const supabase = createClient();

  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    user_id: profile.id,
    message: trimmed,
  });

  if (error) {
    return { error: error.message };
  }

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

  if (profile.role !== "member") {
    return { error: "Only assignees upload proof." };
  }

  const supabase = createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("status, assigned_to")
    .eq("id", taskId)
    .single();

  if (!task || task.assigned_to !== profile.id) {
    return { error: "Task not found." };
  }

  if (task.status !== "in_progress") {
    return { error: "Proof can only be uploaded while task is in progress." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ proof_url: proofUrl })
    .eq("id", taskId);

  if (error) {
    return { error: error.message };
  }

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
  optionalLink?: string,
  totalTimeSeconds?: number
) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, status, assigned_to, assigned_by, proof_url, title")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    return { error: "Task not found." };
  }

  if (task.assigned_to !== profile.id) {
    return { error: "Only assignee may submit the task." };
  }

  if (!task.proof_url) {
    return { error: "Proof is required before submitting." };
  }

  const noteTrim = String(completionNote ?? "").trim();
  if (!noteTrim) {
    return { error: "Completion note is required." };
  }

  // Update task status to waiting_review (Submitted)
  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: "waiting_review" })
    .eq("id", taskId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Record activity
  await supabase.from("task_activity").insert({
    task_id: taskId,
    performed_by: profile.id,
    action: "submitted",
    old_status: task.status,
    new_status: "waiting_review",
  });

  // Insert completion note as a comment, include optional link and time
  const parts = [noteTrim];
  if (optionalLink) parts.push(`Link: ${optionalLink}`);
  if (typeof totalTimeSeconds === "number") {
    parts.push(`Total time (seconds): ${totalTimeSeconds}`);
  }

  await supabase.from("task_comments").insert({
    task_id: taskId,
    user_id: profile.id,
    message: parts.join("\n"),
  });

  await supabase.from("audit_log").insert({
    user_id: profile.id,
    action: "task_submitted",
    entity_type: "task",
    entity_id: taskId,
    reason: null,
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);

  // Notify founders (super_admin role)
  const { data: founders } = await supabase
    .from("users")
    .select("id, email")
    .eq("role", "super_admin")
    .eq("is_active", true);

  for (const f of founders ?? []) {
    if (f?.email) {
      await sendTaskNotification({
        to: f.email,
        subject: "Task submitted for review",
        taskTitle: task.title,
        message: `${profile.name} submitted the task for review.`,
      });
    }
    await supabase.from("notifications").insert({
      user_id: f.id,
      title: "Task submitted for review",
      message: `${profile.name} submitted task: ${task.title}`,
      link: `/tasks/${taskId}`,
    });
  }

  return { success: true };
}

export async function getAssignableMembers() {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return [];
  }

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
