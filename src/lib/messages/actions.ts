"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function getActiveUsers() {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export async function getUserTasks() {
  const profile = await requireUserProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title")
    .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function sendMessageAction(formData: FormData) {
  const profile = await requireUserProfile();

  const type = String(formData.get("type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const recipientIdInput = String(formData.get("recipient_id") ?? "").trim();
  const taskIdInput = String(formData.get("task_id") ?? "").trim();

  if (!title || !content || !type) {
    return { error: "Type, Title, and Content are required." };
  }

  if (type === "announcement" && profile.role === "member") {
    return { error: "Only administrators can send announcements." };
  }

  const recipient_id = recipientIdInput || null;
  const task_id = taskIdInput || null;

  if (type !== "announcement" && !recipient_id) {
    return { error: "Recipient is required for this message type." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("messages").insert({
    sender_id: profile.id,
    recipient_id,
    title,
    content,
    type,
    task_id,
    status: type === "leave_request" ? "pending" : "approved",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/messages");
  return { success: true };
}

export async function updateLeaveRequestStatusAction(
  messageId: string,
  status: "approved" | "rejected"
) {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return { error: "Only administrators can review leave requests." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("messages")
    .update({ status })
    .eq("id", messageId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/messages");
  return { success: true };
}

export async function getLatestNotifications() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, is_read, link, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to load notifications:", error.message);
    return [];
  }

  return data ?? [];
}

export async function markAllNotificationsAsRead() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);

  if (error) {
    console.error("Failed to mark notifications read:", error.message);
    return { error: error.message };
  }

  return { success: true };
}
