import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getWeekStartDateString } from "@/lib/performance/week";
import { getFounderCommitmentForWeek } from "@/lib/founder-commitment/actions";
import { FounderCommitmentReadonly } from "@/components/dashboard/founder-commitment-readonly";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function ManagerDashboardPage() {
  const profile = await requireRole("admin");
  const weekStart = getWeekStartDateString();
  const commitment = await getFounderCommitmentForWeek(weekStart);

  const supabase = createClient();
  const { data: members } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("role", "member")
    .eq("is_active", true)
    .order("name");

  // Load dashboard metrics
  const { count: pendingTasks } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .not("status", "in", '("completed","approved")');

  const { count: activeLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .not("stage", "in", '("deal_won","deal_lost")');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getRoleDisplayName("admin")} Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome, {profile.name}</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeads ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <FounderCommitmentReadonly
        weekStart={weekStart}
        commitmentText={commitment?.commitment_text ?? null}
      />

      <section className="rounded-xl border p-6">
        <h2 className="mb-3 font-medium">Team performance profiles</h2>
        <ul className="space-y-2">
          {(members ?? []).map((member) => (
            <li key={member.id}>
              <Link
                href={`/dashboard/team/${member.id}`}
                className="text-sm font-medium hover:underline"
              >
                {member.name}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {member.email}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
