"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { recordLogoutAttendance } from "@/lib/services/attendance-service";
import { sendPushToUser, sendPushToUsers } from "@/lib/notifications/push";
import { notifyUser } from "@/lib/notifications/notify";

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

  const titleByType: Record<string, string> = {
    direct: "New Direct Message",
    leave_request: "New Leave Request",
    task_clarification: "New Task Clarification",
  };

  if (recipient_id) {
    await sendPushToUser(recipient_id, {
      title: titleByType[type] ?? "New Message",
      message: content.slice(0, 100),
      link: "/messages",
    });
  } else if (type === "announcement") {
    const { data: recipients } = await supabase
      .from("users")
      .select("id")
      .neq("id", profile.id)
      .eq("is_active", true);

    if (recipients?.length) {
      await sendPushToUsers(
        recipients.map((r) => r.id),
        { title: `Announcement: ${title}`, message: content.slice(0, 100), link: "/messages" }
      );
    }
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

  const { data: messageRow, error: fetchError } = await supabase
    .from("messages")
    .select("id, sender_id, title, content, type, is_emergency_checkout")
    .eq("id", messageId)
    .single();

  if (fetchError || !messageRow) {
    return { error: fetchError?.message ?? "Message not found." };
  }

  if (messageRow.is_emergency_checkout && profile.role !== "super_admin") {
    return { error: "Only founders can review emergency checkout requests." };
  }

  const { error } = await supabase.from("messages").update({ status }).eq("id", messageId);
  if (error) {
    return { error: error.message };
  }

  const isEmergencyCheckout = messageRow.is_emergency_checkout;

  if (messageRow.type === "leave_request" && !isEmergencyCheckout) {
    // Regular leave request: the DB trigger already writes the notification
    // row, this just adds the outside-the-app push for it.
    await sendPushToUser(messageRow.sender_id, {
      title: `Leave Request ${status === "approved" ? "Approved" : "Rejected"}`,
      message: `Your leave request has been ${status} by the administrator.`,
      link: "/messages",
    });
  }

  if (messageRow.type === "leave_request") {
    if (status === "approved") {
      try {
        const { data: userRow } = await supabase
          .from("users")
          .select("id, shift_end, email, name")
          .eq("id", messageRow.sender_id)
          .single();

        const shiftEnd = (userRow?.shift_end as string) ?? "23:59:59";

        try {
          await recordLogoutAttendance(messageRow.sender_id, shiftEnd);
        } catch (e) {
          console.error("Failed to record logout for emergency approval:", e);
        }

        // ✅ FIX: actually check the member out
        await supabase
          .from("users")
          .update({ is_checked_in: false })
          .eq("id", messageRow.sender_id);

        await supabase.from("audit_log").insert({
          user_id: profile.id,
          action: "emergency_checkout_approved",
          entity_type: "messages",
          entity_id: messageId,
          reason: `Approved emergency checkout for ${messageRow.sender_id}`,
        });

        await notifyUser({
          userId: messageRow.sender_id,
          title: "Emergency checkout approved",
          message: `Your emergency checkout request was approved by ${profile.name}. You have been checked out.`,
          link: "/dashboard",
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (status === "rejected") {
      try {
        const { data: userRow } = await supabase
          .from("users")
          .select("id, strikes, email, name")
          .eq("id", messageRow.sender_id)
          .single();

        const currentStrikes = (userRow?.strikes as number) ?? 0;
        await supabase
          .from("users")
          .update({ strikes: currentStrikes + 1 })
          .eq("id", messageRow.sender_id);

        await supabase.from("audit_log").insert({
          user_id: profile.id,
          action: "emergency_checkout_rejected",
          entity_type: "messages",
          entity_id: messageId,
          reason: "Rejected by founder",
        });

        await notifyUser({
          userId: messageRow.sender_id,
          title: "Emergency checkout rejected",
          message: "Your emergency checkout request was rejected and a strike was applied.",
          link: "/dashboard",
        });
      } catch (e) {
        console.error(e);
      }
    }
  }

  revalidatePath("/messages");
  return { success: true };
}

export async function getLatestNotifications() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, is_read, link, created_at, type, reference_id")
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
export async function clearAllNotifications() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", profile.id);

  if (error) {
    console.error("Failed to clear notifications:", error.message);
    return { error: error.message };
  }

  return { success: true };
}

export async function deleteNotificationAction(notificationId: string) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", profile.id);

  if (error) {
    console.error("Failed to delete notification:", error.message);
    return { error: error.message };
  }

  return { success: true };
}

export async function markNotificationReadAction(notificationId: string) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", profile.id);

  if (error) {
    console.error("Failed to mark notification read:", error.message);
    return { error: error.message };
  }

  return { success: true };
}