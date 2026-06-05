import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { getWeekStartDateString } from "@/lib/performance/week";
import { getFounderCommitmentForWeek } from "@/lib/founder-commitment/actions";
import { FounderCommitmentReadonly } from "@/components/dashboard/founder-commitment-readonly";
import { getLatestPerformanceScoreForUser } from "@/lib/performance/actions";
import { PerformanceScoreSection } from "@/components/performance/performance-score-section";

export default async function EmployeeDashboardPage() {
  const profile = await requireRole("member");
  const weekStart = getWeekStartDateString();
  const commitment = await getFounderCommitmentForWeek(weekStart);
  const ownScore = await getLatestPerformanceScoreForUser(profile.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getRoleDisplayName("member")} Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome, {profile.name}</p>
      </div>

      <FounderCommitmentReadonly
        weekStart={weekStart}
        commitmentText={commitment?.commitment_text ?? null}
      />

      <section className="rounded-xl border p-6">
        <h2 className="mb-4 font-medium">Your performance score</h2>
        <PerformanceScoreSection
          score={ownScore}
          override={null}
          showOverrideModal={false}
          targetUserId={profile.id}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href={`/dashboard/team/${profile.id}`} className="hover:underline">
            View full profile
          </Link>
        </p>
      </section>
    </div>
  );
}
