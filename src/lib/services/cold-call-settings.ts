import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications/notify";

export async function getDefaultColdCallTarget(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cold_call_settings")
    .select("default_target")
    .eq("id", 1)
    .maybeSingle();
  return data?.default_target ?? 15;
}

/** Super_admin-only: sets the global default Cold Calls target for everyone without an override. */
export async function setDefaultColdCallTarget(target: number, updatedBy: string): Promise<void> {
  if (!Number.isInteger(target) || target <= 0) {
    throw new Error("Target must be a positive whole number.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("cold_call_settings")
    .upsert({ id: 1, default_target: target, updated_by: updatedBy, updated_at: new Date().toISOString() });

  if (error) throw new Error(`Failed to update Cold Calls target: ${error.message}`);
}

/** Super_admin-only: sets (or clears, with target=null) a per-user override. */
export async function setUserColdCallOverride(
  userId: string,
  target: number | null,
  updatedBy: string
): Promise<void> {
  if (target !== null && (!Number.isInteger(target) || target <= 0)) {
    throw new Error("Target must be a positive whole number.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ cold_call_target_override: target })
    .eq("id", userId);

  if (error) throw new Error(`Failed to update override: ${error.message}`);

  await notifyUser({
    userId,
    title: "Cold Calls target updated",
    message:
      target === null
        ? "Your Cold Calls target now follows the team default."
        : `Your daily Cold Calls target is now ${target}.`,
    link: "/tasks",
    type: "cold_call_target_updated",
  });

  // updatedBy currently unused beyond audit-trail intent; kept in the
  // signature so callers always pass who made the change.
  void updatedBy;
}

/** Resolves the effective target for one user: their override, or the global default. */
export async function resolveColdCallTarget(userId: string): Promise<number> {
  const admin = createAdminClient();
  const [{ data: user }, defaultTarget] = await Promise.all([
    admin.from("users").select("cold_call_target_override").eq("id", userId).maybeSingle(),
    getDefaultColdCallTarget(),
  ]);
  return user?.cold_call_target_override ?? defaultTarget;
}

export interface ColdCallTargetRow {
  id: string;
  name: string;
  override: number | null;
  effectiveTarget: number;
}

/** For the settings UI: every active member with their resolved target. */
export async function listColdCallTargets(): Promise<ColdCallTargetRow[]> {
  const admin = createAdminClient();
  const [{ data: users }, defaultTarget] = await Promise.all([
    admin
      .from("users")
      .select("id, name, cold_call_target_override")
      .eq("role", "member")
      .eq("is_active", true)
      .order("name"),
    getDefaultColdCallTarget(),
  ]);

  return (users ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    override: u.cold_call_target_override,
    effectiveTarget: u.cold_call_target_override ?? defaultTarget,
  }));
}