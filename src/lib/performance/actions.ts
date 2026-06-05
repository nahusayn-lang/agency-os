"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canOverridePerformanceScore } from "@/lib/performance/permissions";
import { buildOverrideTargetEntity } from "@/lib/performance/overrides";
import {
  PERFORMANCE_OVERRIDE_ACTION,
  type PerformanceScore,
  type PerformanceScoreOverridePayload,
} from "@/lib/types/performance";
import type { UserRole } from "@/lib/types/database";

function computeTotalScore(payload: {
  task_score: number;
  attendance_score: number;
  lead_score: number;
  report_score: number;
}): number {
  return Math.round(
    (payload.task_score * 0.4 +
      payload.attendance_score * 0.2 +
      payload.lead_score * 0.2 +
      payload.report_score * 0.2) *
      100
  ) / 100;
}

export async function getPerformanceScoreForUser(
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<PerformanceScore | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("performance_scores")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  return data as PerformanceScore | null;
}

export async function getLatestPerformanceScoreForUser(
  userId: string
): Promise<PerformanceScore | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("performance_scores")
    .select("*")
    .eq("user_id", userId)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as PerformanceScore | null;
}

export async function getGodModeOverridesForUserPeriod(
  userId: string,
  periodStart: string
) {
  const profile = await requireUserProfile();
  if (profile.role !== "super_admin" && profile.role !== "admin") {
    return [];
  }

  const supabase = createClient();
  const target = buildOverrideTargetEntity(userId, periodStart);
  const { data } = await supabase
    .from("god_mode_overrides")
    .select("id, action, target_entity, reason, created_at, super_admin_id")
    .eq("target_entity", target)
    .eq("action", PERFORMANCE_OVERRIDE_ACTION)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getAllGodModeOverrides() {
  await requireUserProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from("god_mode_overrides")
    .select(
      "id, action, target_entity, reason, created_at, super_admin_id"
    )
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function overridePerformanceScoreAction(params: {
  targetUserId: string;
  periodStart: string;
  periodEnd: string;
  task_score: number;
  attendance_score: number;
  lead_score: number;
  report_score: number;
  reasonNote: string;
}) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: targetUser, error: userError } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", params.targetUserId)
    .single();

  if (userError || !targetUser) {
    return { error: "User not found." };
  }

  if (
    !canOverridePerformanceScore(profile, {
      id: targetUser.id,
      role: targetUser.role as UserRole,
    })
  ) {
    return { error: "You are not allowed to override this user's score." };
  }

  const { data: existingScore } = await supabase
    .from("performance_scores")
    .select("id")
    .eq("user_id", params.targetUserId)
    .eq("period_start", params.periodStart)
    .eq("period_end", params.periodEnd)
    .maybeSingle();

  if (!existingScore) {
    return {
      error: "No calculated performance score exists for this period yet.",
    };
  }

  const note = params.reasonNote.trim();
  if (!note) {
    return { error: "Override reason is required." };
  }
  if (note.length < 10) {
    return { error: "Override reason must be at least 10 characters." };
  }

  const report_score = 0;
  const payload: PerformanceScoreOverridePayload = {
    task_score: params.task_score,
    attendance_score: params.attendance_score,
    lead_score: params.lead_score,
    report_score,
    total_score: computeTotalScore({
      task_score: params.task_score,
      attendance_score: params.attendance_score,
      lead_score: params.lead_score,
      report_score,
    }),
    note,
  };

  const { error: overrideError } = await supabase
    .from("god_mode_overrides")
    .insert({
      super_admin_id: profile.id,
      action: PERFORMANCE_OVERRIDE_ACTION,
      target_entity: buildOverrideTargetEntity(
        params.targetUserId,
        params.periodStart
      ),
      reason: JSON.stringify(payload),
    });

  if (overrideError) {
    return { error: overrideError.message };
  }

  revalidatePath(`/dashboard/team/${params.targetUserId}`);
  revalidatePath("/dashboard/founder");
  return { success: true };
}
