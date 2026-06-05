import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  canOverridePerformanceScore,
  canViewTeamProfile,
} from "@/lib/performance/permissions";
import { getLatestPerformanceScoreForUser } from "@/lib/performance/actions";
import { findLatestScoreOverride } from "@/lib/performance/overrides";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { PerformanceScoreSection } from "@/components/performance/performance-score-section";
import type { UserRole } from "@/lib/types/database";
import { PERFORMANCE_OVERRIDE_ACTION } from "@/lib/types/performance";

interface TeamProfilePageProps {
  params: { userId: string };
}

export default async function TeamProfilePage({ params }: TeamProfilePageProps) {
  const viewer = await requireUserProfile();

  if (!canViewTeamProfile(viewer, params.userId)) {
    redirect(getDashboardPathForRole(viewer.role));
  }

  const supabase = createClient();
  const { data: targetUser, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", params.userId)
    .single();

  if (error || !targetUser) {
    notFound();
  }

  const score = await getLatestPerformanceScoreForUser(params.userId);

  let override = null;
  if (
    score &&
    (viewer.role === "admin" || viewer.role === "super_admin")
  ) {
    const { data: overrides } = await supabase
      .from("god_mode_overrides")
      .select("action, target_entity, reason, created_at")
      .eq("action", PERFORMANCE_OVERRIDE_ACTION)
      .order("created_at", { ascending: false });

    override = findLatestScoreOverride(
      overrides ?? [],
      params.userId,
      score.period_start
    )?.payload ?? null;
  }

  const showOverrideModal =
    score !== null &&
    canOverridePerformanceScore(viewer, {
      id: targetUser.id,
      role: targetUser.role as UserRole,
    });

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={getDashboardPathForRole(viewer.role)}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {targetUser.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {targetUser.email} · {targetUser.role}
        </p>
      </div>

      <section className="rounded-xl border p-6">
        <h2 className="mb-4 font-medium">Performance score</h2>
        <PerformanceScoreSection
          score={score}
          override={override}
          showOverrideModal={showOverrideModal}
          targetUserId={targetUser.id}
        />
      </section>
    </div>
  );
}
