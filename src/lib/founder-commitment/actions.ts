"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { requireRole, requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getWeekStartDateString } from "@/lib/performance/week";
import type { FounderWeeklyCommitment } from "@/lib/types/founder-commitment";

export async function getFounderCommitmentForWeek(
  weekStart?: string
): Promise<FounderWeeklyCommitment | null> {
  const supabase = createClient();
  const week = weekStart ?? getWeekStartDateString();

  const { data } = await supabase
    .from("founder_weekly_commitments")
    .select("*")
    .eq("week_start", week)
    .maybeSingle();

  return data as FounderWeeklyCommitment | null;
}

export async function saveFounderWeeklyCommitmentAction(
  commitmentText: string,
  weekStart?: string
) {
  const profile = await requireRole("super_admin");
  const trimmed = commitmentText.trim();
  const week = weekStart ?? getWeekStartDateString();

  if (!trimmed) {
    return { error: "Commitment text is required." };
  }

  const supabase = createClient();

  const { data: existing } = await supabase
    .from("founder_weekly_commitments")
    .select("id")
    .eq("week_start", week)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("founder_weekly_commitments")
      .update({
        commitment_text: trimmed,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("founder_weekly_commitments").insert({
      week_start: week,
      commitment_text: trimmed,
      updated_by: profile.id,
    });

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/dashboard/founder");
  revalidatePath("/dashboard/manager");
  revalidatePath("/dashboard/employee");
  return { success: true };
}

export async function getFounderCommitmentForDisplay() {
  await requireUserProfile();
  return getFounderCommitmentForWeek();
}
