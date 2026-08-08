import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications/notify";
import { resolveColdCallTarget } from "@/lib/services/cold-call-settings";

/**
 * Runs once a day (cron). Creates one "Cold Calls" task per active
 * member for today, if one doesn't already exist — the unique index on
 * (assigned_to, mandatory_type, mandatory_date) makes the insert
 * naturally idempotent even if the cron fires twice.
 *
 * assigned_by is set to any active super_admin (the task is
 * system-generated, but every task row needs an assigner FK).
 */
export async function generateDailyColdCallTasks(): Promise<{ created: number; skipped: number }> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, server date

  const { data: founder } = await admin
    .from("users")
    .select("id")
    .eq("role", "super_admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!founder) {
    throw new Error("No active super_admin found to assign Cold Calls tasks from.");
  }

  const { data: members, error: membersError } = await admin
    .from("users")
    .select("id, name")
    .eq("role", "member")
    .eq("is_active", true);

  if (membersError) {
    throw new Error(`Failed to list members: ${membersError.message}`);
  }

  let created = 0;
  let skipped = 0;

  for (const member of members ?? []) {
    const target = await resolveColdCallTarget(member.id);

    const { error: insertError } = await admin.from("tasks").insert({
      title: `Cold Calls — ${today}`,
      description: `Make ${target} cold calls today. Upload a screenshot (call log) and enter how many you completed when you submit.`,
      priority: "high",
      assigned_by: founder.id,
      assigned_to: member.id,
      status: "pending",
      is_mandatory: true,
      mandatory_type: "cold_calls",
      mandatory_date: today,
      mandatory_target_count: target,
    });

    if (insertError) {
      // Unique violation just means today's task already exists — that's
      // expected, not a failure.
      if (insertError.code === "23505") {
        skipped++;
        continue;
      }
      throw new Error(`Failed to create Cold Calls task for ${member.name}: ${insertError.message}`);
    }

    created++;

    await notifyUser({
      userId: member.id,
      title: "Today's Cold Calls target",
      message: `Make ${target} cold calls today. This is mandatory and must be submitted before checkout.`,
      link: "/tasks",
      type: "cold_call_task_created",
    });
  }

  return { created, skipped };
}