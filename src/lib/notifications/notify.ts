import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/notifications/push";

export type NotifyInput = {
  userId: string;
  title: string;
  message: string;
  link?: string;
  type?: string;
  referenceId?: string;
};

/**
 * Single entry point for creating a notification: writes the row (so it
 * shows up in the bell / realtime feed) AND fires the outside-the-app push
 * notification, together, every time. Adding a new notification anywhere in
 * the app should mean one call to this function — never a bare
 * `.from("notifications").insert(...)`, or the push half gets forgotten
 * (which was the original bug: the push endpoint existed but nothing called it).
 *
 * Uses the admin (service role) client because notifications are almost
 * always written for a DIFFERENT user than the one performing the action
 * (e.g. an admin approving a request writes a row for the employee), which
 * the regular RLS-bound client cannot do.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    message: input.message,
    link: input.link ?? "/",
    type: input.type ?? null,
    reference_id: input.referenceId ?? null,
  });

  if (error) {
    console.error("Failed to create notification:", error.message);
    return;
  }

  await sendPushToUser(input.userId, {
    title: input.title,
    message: input.message,
    link: input.link,
  });
}

/** Same notification content fanned out to multiple users (e.g. all admins). */
export async function notifyUsers(userIds: string[], payload: Omit<NotifyInput, "userId">): Promise<void> {
  const unique = Array.from(new Set(userIds));
  await Promise.all(unique.map((userId) => notifyUser({ ...payload, userId })));
}

/**
 * Notifies every active super_admin/admin. Single place for the
 * "fetch admins, then notify" pattern that used to be copy-pasted in
 * several routes (and, in those copies, often forgot the push half —
 * this always sends both since it goes through notifyUsers -> notifyUser).
 */
export async function notifyAdmins(payload: Omit<NotifyInput, "userId">): Promise<void> {
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("users")
    .select("id")
    .in("role", ["super_admin", "admin"])
    .eq("is_active", true);

  if (admins?.length) {
    await notifyUsers(admins.map((a) => a.id), payload);
  }
}