"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications/notify";

async function recordWeeklyTargetAudit(supabase: ReturnType<typeof createClient>, params: { userId: string; targetId: string; action: string; oldCompletion?: number; newCompletion?: number }) {
  const { error } = await supabase.from("weekly_targets_audit").insert({ weekly_target_id: params.targetId, user_id: params.userId, action: params.action, old_completion_percentage: params.oldCompletion, new_completion_percentage: params.newCompletion });
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from("audit_log").insert({ user_id: params.userId, action: "weekly_target_update", entity_type: "weekly_target", entity_id: params.targetId, reason: params.action });
  if (auditError) throw new Error(auditError.message);
}

export async function createWeeklyTargetAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const profile = await requireUserProfile();
  if (profile.role === "member") return { error: "Only admins can create weekly targets." };

  const userId = (formData.get("user_id") as string) ?? "";
  const targetName = (formData.get("target_name") as string) ?? "";
  if (!userId || !targetName.trim()) return { error: "User and target name are required." };

  const supabase = createClient();
  const { data: user, error: userError } = await supabase.from("users").select("id").eq("id", userId).single();
  if (userError || !user) return { error: "User not found." };

  const { data: target, error } = await supabase.from("weekly_targets").insert({ user_id: userId, admin_id: profile.id, target_name: targetName.trim(), completion_percentage: 0 }).select("id").single();
  if (error || !target) return { error: error?.message ?? "Failed to create weekly target." };

  await recordWeeklyTargetAudit(supabase, { userId: profile.id, targetId: target.id, action: "target_assigned", newCompletion: 0 });
  revalidatePath("/targets");
  return { success: true };
}

export async function createWeeklyTargetFormAction(formData: FormData): Promise<void> {
  const result = await createWeeklyTargetAction(formData);
  if (result?.error) redirect(`/targets?error=${encodeURIComponent(result.error)}`);
  redirect("/targets");
}

export async function updateWeeklyTargetCompletionAction(targetId: string, completionPercentage: number): Promise<{ error?: string; success?: boolean }> {
  const profile = await requireUserProfile();
  if (completionPercentage < 0 || completionPercentage > 100) return { error: "Completion percentage must be between 0 and 100." };

  const supabase = createClient();
  const { data: currentTarget, error: fetchError } = await supabase.from("weekly_targets").select("completion_percentage, user_id").eq("id", targetId).single();
  if (fetchError || !currentTarget) return { error: "Weekly target not found." };
  if (profile.role === "member" && currentTarget.user_id !== profile.id) return { error: "Unauthorized" };

  const { error } = await supabase.from("weekly_targets").update({ completion_percentage: completionPercentage }).eq("id", targetId);
  if (error) return { error: error.message };

  await recordWeeklyTargetAudit(supabase, { userId: profile.id, targetId, action: "completion_updated", oldCompletion: currentTarget.completion_percentage, newCompletion: completionPercentage });

  // Don't notify when the employee updated their own target's completion.
  if (profile.id !== currentTarget.user_id) {
    await notifyUser({
      userId: currentTarget.user_id,
      title: "Weekly target updated",
      message: `Tumhare weekly target ka completion ${completionPercentage}% update ho gaya hai.`,
      link: "/targets",
      type: "weekly_target",
      referenceId: targetId,
    });
  }

  revalidatePath("/targets");
  return { success: true };
}

export async function updateWeeklyTargetNotesAction(targetId: string, adminNotes: string): Promise<{ error?: string; success?: boolean }> {
  const profile = await requireUserProfile();
  if (profile.role === "member") return { error: "Only admins can update notes." };

  const supabase = createClient();
  const { data: target, error: fetchError } = await supabase.from("weekly_targets").select("user_id").eq("id", targetId).single();
  if (fetchError || !target) return { error: "Weekly target not found." };

  const { error } = await supabase.from("weekly_targets").update({ admin_notes: adminNotes.trim() || null }).eq("id", targetId);
  if (error) return { error: error.message };

  await recordWeeklyTargetAudit(supabase, { userId: profile.id, targetId, action: "admin_notes_updated" });

  // Notes are always admin-authored (member role is blocked above), so this
  // is always for the employee — no self-notify check needed here.
  await notifyUser({
    userId: target.user_id,
    title: "Weekly target note added",
    message: `${profile.name} ne tumhare weekly target par ek note add kiya hai.`,
    link: "/targets",
    type: "weekly_target",
    referenceId: targetId,
  });

  revalidatePath("/targets");
  return { success: true };
}

export async function getWeeklyTargetsForMember(userId: string) {
  await requireUserProfile();
  const supabase = createClient();
  const { data, error } = await supabase.from("weekly_targets").select("*, admin:admin_id(id, name, email)").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllWeeklyTargetsForAdmin(memberId?: string) {
  const profile = await requireUserProfile();
  if (profile.role === "member") throw new Error("Unauthorized");

  const supabase = createClient();
  let query = supabase.from("weekly_targets").select("*, user:user_id(id, name, email), admin:admin_id(id, name, email)").order("created_at", { ascending: false });
  if (memberId) query = query.eq("user_id", memberId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}