import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    // Push isn't configured in this environment (e.g. local dev without
    // VAPID keys set) — fail silently rather than crashing every action
    // that tries to send a push. In-app notifications still work fine.
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export type PushPayload = {
  title: string;
  message: string;
  link?: string;
};

/**
 * Sends a system-level (outside-the-app) push notification to every device
 * a user has subscribed on. Safe to call unconditionally — no-ops quietly
 * if VAPID isn't configured or the user has no subscription.
 * Automatically removes subscriptions the browser has revoked (410/404).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapid()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    message: payload.message,
    link: payload.link ?? "/",
  });

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(JSON.parse(row.subscription), body);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription no longer valid on the browser's end — clean it up.
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        } else {
          console.error(`Push send failed for user ${userId}:`, err);
        }
      }
    })
  );
}

/** Convenience helper for fan-out notifications (e.g. "notify all admins"). */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const unique = Array.from(new Set(userIds));
  await Promise.all(unique.map((id) => sendPushToUser(id, payload)));
}