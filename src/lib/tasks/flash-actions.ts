"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications/notify";
import { canManageTasks } from "@/lib/tasks/permissions";

export async function createFlashTaskAction(formData: FormData): Promise<{ error?: string }> {
  const profile = await requireUserProfile();

  if (!canManageTasks(profile.role)) {
    return { error: "Only admins can assign Flash Tasks." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "").trim();
  const durationHours = Number(formData.get("duration_hours"));

  if (!title || !assignedTo) {
    return { error: "Title and assignee are required." };
  }
  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 24) {
    return { error: "Duration must be between 1 and 24 hours." };
  }

  const supabase = createClient();

  const { data: assignee, error: assigneeError } = await supabase
    .from("users")
    .select("id, is_active")
    .eq("id", assignedTo)
    .single();

  if (assigneeError || !assignee || !assignee.is_active) {
    return { error: "Assignee not found or inactive." };
  }

  // Not started yet — session_start_time and deadline are set later, when
  // the assignee actually presses Start (that's when the clock begins).
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: description || null,
      priority: "high",
      assigned_by: profile.id,
      assigned_to: assignedTo,
      status: "pending",
      is_flash_task: true,
      flash_duration_hours: durationHours,
    })
    .select("id, title")
    .single();

  if (error || !task) {
    return { error: error?.message ?? "Failed to create Flash Task." };
  }

  await supabase.from("task_activity").insert({
    task_id: task.id,
    performed_by: profile.id,
    action: "flash_assigned",
    old_status: null,
    new_status: "pending",
  });

  await notifyUser({
    userId: assignedTo,
    title: "Flash Task Assigned",
    message: `${profile.name} assigned you a ${durationHours}h Flash Task: "${task.title}".`,
    link: "/dashboard/employee",
    type: "flash_task_assigned",
    referenceId: task.id,
  });

  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/founder");

  return {};
}