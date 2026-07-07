import { requireRole } from "@/lib/auth/session";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeekStartDateString } from "@/lib/performance/week";
import { getFounderCommitmentForWeek } from "@/lib/founder-commitment/actions";
import { getAllGodModeOverrides } from "@/lib/performance/actions";
import { WeeklyCommitmentCard } from "@/components/dashboard/weekly-commitment-card";
import { OverrideHistoryTable } from "@/components/dashboard/override-history-table";
import { TeamProfilesList } from "@/components/dashboard/team-profiles-list";
import { AttendanceCard } from "@/components/dashboard/attendance-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getTodayDateString } from "@/lib/auth/attendance";
import { FinesAdminTable, type AdminFineRow } from "@/components/dashboard/fines-admin-table";
import { StrikeControlPanel, type StrikeRow } from "@/components/dashboard/strike-control-panel";

export default async function FounderDashboardPage() {
  const profile = await requireRole("super_admin");
  const weekStart = getWeekStartDateString();
  const commitment = await getFounderCommitmentForWeek(weekStart);
  const overrides = await getAllGodModeOverrides();

  const supabase = createClient();
  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from("users")
    .select("is_checked_in, last_checkin_at, shift_start, shift_end")
    .eq("id", profile.id)
    .single();

  const isCheckedIn = userRow?.is_checked_in ?? false;
  const lastCheckinAt = userRow?.last_checkin_at ?? null;

  // Aaj ka attendance record hai ya nahi
  const today = getTodayDateString();
  const { data: todayAttendance } = await admin
    .from("attendance")
    .select("id")
    .eq("user_id", profile.id)
    .eq("date", today)
    .maybeSingle();

  const checkedOutToday = !isCheckedIn && !!todayAttendance;

  const { data: teamMembers } = await supabase
    .from("users")
    .select("id, name, email, role")
    .in("role", ["member", "admin"])
    .eq("is_active", true)
    .order("name");

  const actorIds = Array.from(new Set(overrides.map((row) => row.super_admin_id)));
  const { data: actors } = await supabase
    .from("users")
    .select("id, name")
    .in("id", actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"]);

  const actorNames = new Map((actors ?? []).map((a) => [a.id, a.name]));

  const { count: totalLeads } = await supabase.from("leads").select("*", { count: "exact", head: true });
  const { count: activeLeads } = await supabase.from("leads").select("*", { count: "exact", head: true }).not("stage", "in", '("deal_won","deal_lost")');
  const { count: dealsClosed } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "deal_won");
  const { data: wonLeads } = await supabase.from("leads").select("deal_value").eq("stage", "deal_won");
  const revenueGenerated = (wonLeads ?? []).reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
  const { count: lostDeals } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "deal_lost");

  // All employee fines — super_admin can Mark Paid / Waive
  const { data: allFinesRaw } = await admin
    .from("fines")
    .select("id, amount, status, deadline, proof_url, dispute_reason, users:user_id(name)")
    .order("created_at", { ascending: false });

  const allFines: AdminFineRow[] = (allFinesRaw ?? []).map((f) => ({
    id: f.id,
    amount: f.amount,
    status: f.status,
    deadline: f.deadline,
    proof_url: f.proof_url,
    dispute_reason: f.dispute_reason,
    user_name: (f.users as unknown as { name: string } | null)?.name ?? "Unknown",
  }));

  // Active strikes — founder-only, private removal control
  const { data: activeStrikesRaw } = await admin
    .from("strikes")
    .select("id, reason, is_removed, created_at, users:user_id(name)")
    .eq("is_removed", false)
    .order("created_at", { ascending: false });

  const activeStrikes: StrikeRow[] = (activeStrikesRaw ?? []).map((s) => ({
    id: s.id,
    reason: s.reason,
    is_removed: s.is_removed,
    created_at: s.created_at,
    user_name: (s.users as unknown as { name: string } | null)?.name ?? "Unknown",
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getRoleDisplayName("super_admin")} Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome, {profile.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <AttendanceCard
          isCheckedIn={isCheckedIn}
          lastCheckinAt={lastCheckinAt}
          shiftStart={userRow?.shift_start ?? null}
          shiftEnd={userRow?.shift_end ?? null}
          checkedOutToday={checkedOutToday}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalLeads ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeLeads ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals Closed</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{dealsClosed ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">${revenueGenerated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lost Deals</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{lostDeals ?? 0}</div></CardContent>
        </Card>
      </div>

      <WeeklyCommitmentCard weekStart={weekStart} initialText={commitment?.commitment_text ?? ""} />

      <FinesAdminTable fines={allFines} isSuperAdmin={true} />

      <StrikeControlPanel strikes={activeStrikes} />

      <TeamProfilesList members={teamMembers ?? []} />
      <OverrideHistoryTable overrides={overrides} actorNames={actorNames} />
    </div>
  );
}