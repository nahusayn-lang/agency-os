import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications/notify";
import { resolveColdCallTarget } from "@/lib/services/cold-call-settings";

/**
 * Called from the check-in route, right after a successful check-in.
 * Creates today's "Cold Calls" task for that one user, if one doesn't
 * already exist — the unique index on (assigned_to, mandatory_type,
 * mandatory_date) makes this naturally idempotent even if check-in
 * somehow runs twice for the same day.
 *
 * Best-effort: never throws back into the check-in flow. A failure here
 * should not block a user from checking in.
 */
export async function ensureColdCallTaskForCheckin(userId: string, userName: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, server date

    const { data: founder } = await admin
      .from("users")
      .select("id")
      .eq("role", "super_admin")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!founder) return;

    const target = await resolveColdCallTarget(userId);

    const { error: insertError } = await admin.from("tasks").insert({
      title: `Cold Calls — ${today}`,
      description: `Make ${target} cold calls today. Upload a screenshot (call log) and enter how many you completed when you submit.`,
      priority: "high",
      assigned_by: founder.id,
      assigned_to: userId,
      status: "pending",
      is_mandatory: true,
      mandatory_type: "cold_calls",
      mandatory_date: today,
      mandatory_target_count: target,
    });

    if (insertError) {
      if (insertError.code === "23505") return; // already exists today — fine
      console.error(`Failed to create Cold Calls task for ${userName}: ${insertError.message}`);
      return;
    }

    await notifyUser({
      userId,
      title: "Today's Cold Calls target",
      message: `Make ${target} cold calls today. This is mandatory and must be submitted before checkout.`,
      link: "/tasks",
      type: "cold_call_task_created",
    });
  } catch (err) {
    console.error("ensureColdCallTaskForCheckin failed:", err);
  }
}