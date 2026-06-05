import { requireRole } from "@/lib/auth/session";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getWeekStartDateString } from "@/lib/performance/week";
import { getFounderCommitmentForWeek } from "@/lib/founder-commitment/actions";
import { getAllGodModeOverrides } from "@/lib/performance/actions";
import { WeeklyCommitmentCard } from "@/components/dashboard/weekly-commitment-card";
import { OverrideHistoryTable } from "@/components/dashboard/override-history-table";
import { TeamProfilesList } from "@/components/dashboard/team-profiles-list";

export default async function FounderDashboardPage() {
  const profile = await requireRole("super_admin");
  const weekStart = getWeekStartDateString();
  const commitment = await getFounderCommitmentForWeek(weekStart);
  const overrides = await getAllGodModeOverrides();

  const supabase = createClient();
  const { data: teamMembers } = await supabase
    .from("users")
    .select("id, name, email, role")
    .in("role", ["member", "admin"])
    .eq("is_active", true)
    .order("name");

  const actorIds = Array.from(
    new Set(overrides.map((row) => row.super_admin_id))
  );
  const { data: actors } = await supabase
    .from("users")
    .select("id, name")
    .in(
      "id",
      actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"]
    );

  const actorNames = new Map((actors ?? []).map((a) => [a.id, a.name]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getRoleDisplayName("super_admin")} Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome, {profile.name}</p>
      </div>

      <WeeklyCommitmentCard
        weekStart={weekStart}
        initialText={commitment?.commitment_text ?? ""}
      />

      <TeamProfilesList members={teamMembers ?? []} />

      <OverrideHistoryTable overrides={overrides} actorNames={actorNames} />
    </div>
  );
}
