import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLatestPerformanceScoreForUser, getGodModeOverridesForUserPeriod } from "@/lib/performance/actions";
import { TeamProfilesList } from "@/components/dashboard/team-profiles-list";
import { PerformanceScoreSection } from "@/components/performance/performance-score-section";

export default async function PerformancePage() {
  const profile = await requireUserProfile();
  const supabase = createClient();
  const isMember = profile.role === "member";

  if (isMember) {
    const score = await getLatestPerformanceScoreForUser(profile.id);
    let override = null;
    if (score) {
      const overrides = await getGodModeOverridesForUserPeriod(profile.id, score.period_start);
      override = overrides && overrides.length > 0 ? JSON.parse(overrides[0].reason) : null;
    }

    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Performance</h1>
        <div className="max-w-xl">
          <PerformanceScoreSection score={score} override={override} showOverrideModal={false} targetUserId={profile.id} />
        </div>
      </div>
    );
  }

  let teamMembers: Array<{ id: string; name: string; email: string; role: string }> = [];
  const { data: members } = await supabase.from("users").select("id, name, email, role").eq("role", "member").eq("is_active", true).order("name");
  teamMembers = members ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Performance</h1>
      <TeamProfilesList members={teamMembers} />
    </div>
  );
}
