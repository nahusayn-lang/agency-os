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
import { FineWalletWidget } from "@/components/dashboard/fine-wallet-widget";
import { getFineAmount, closeStaleShiftSession } from "@/lib/services/strike-fine-engine";

export default async function FounderDashboardPage() {
  const profile = await requireRole("super_admin");
  await closeStaleShiftSession(profile.id);
  const weekStart = getWeekStartDateString();
  const commitment = await getFounderCommitmentForWeek(weekStart);
  const overrides = await getAllGodModeOverrides();

  const supabase = createClient();
  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from("users")
    .select("is_checked_in, last_checkin_at, shift_start, shift_end, checkout_report_pending")
    .eq("id", profile.id)
    .single();

  const isCheckedIn = userRow?.is_checked_in ?? false;
  const reportPending = userRow?.checkout_report_pending ?? false;
  const lastCheckinAt = userRow?.last_checkin_at ?? null;

  const today = getTodayDateString();
  const { data: todayAttendance } = await admin
    .from("attendance")
    .select("id, checkout_time")
    .eq("user_id", profile.id)
    .eq("date", today)
    .maybeSingle();

  // "Marked for today" sirf tab dikhna chahiye jab actually checkout ho
  // chuka ho — sirf row exist karna kaafi nahi (absent-marked row bhi
  // "date = today" ke saath exist karti hai, uska checkout_time null hota hai).
  const checkedOutToday = !isCheckedIn && !!todayAttendance?.checkout_time;

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

  const { count: pendingTasks } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .not("status", "in", '("completed","approved")');

  const { count: totalLeads } = await supabase.from("leads").select("*", { count: "exact", head: true });
  const { count: activeLeads } = await supabase.from("leads").select("*", { count: "exact", head: true }).not("stage", "in", '("deal_won","deal_lost")');
  const { count: dealsClosed } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "deal_won");
  const { data: wonLeads } = await supabase.from("leads").select("deal_value").eq("stage", "deal_won");
  const revenueGenerated = (wonLeads ?? []).reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
  const { count: lostDeals } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "deal_lost");

  const { data: allFinesRaw } = await admin
    .from("fines")
    .select("id, amount, status, deadline, proof_url, payment_comment, users:user_id(name)")
    .order("created_at", { ascending: false });

  const allFines: AdminFineRow[] = (allFinesRaw ?? []).map((f) => ({
    id: f.id,
    amount: f.amount,
    status: f.status,
    deadline: f.deadline,
    proof_url: f.proof_url,
    payment_comment: f.payment_comment,
    user_name: (f.users as unknown as { name: string } | null)?.name ?? "Unknown",
  }));

  const { data: myFines } = await admin
    .from("fines")
    .select("id, amount, status, deadline, proof_url, payment_comment")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const { count: activeStrikeCount } = await admin
    .from("strikes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_removed", false)
    .is("fine_id", null);

  const pendingFineCount = (myFines ?? []).filter(
    (f) => f.status === "pending" || f.status === "submitted"
  ).length;

  const fineAmount = await getFineAmount();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getRoleDisplayName("super_admin")} Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome, {profile.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <AttendanceCard
          isCheckedIn={isCheckedIn}
          lastCheckinAt={lastCheckinAt}
          shiftStart={userRow?.shift_start ?? null}
          shiftEnd={userRow?.shift_end ?? null}
          checkedOutToday={checkedOutToday}
          reportPending={reportPending}
          activeStrikeCount={activeStrikeCount ?? 0}
          pendingFineCount={pendingFineCount}
          fineAmount={fineAmount}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingTasks ?? 0}</div></CardContent>
        </Card>
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

      <FineWalletWidget fines={myFines ?? []} />

      <TeamProfilesList members={teamMembers ?? []} />
      <OverrideHistoryTable overrides={overrides} actorNames={actorNames} />
    </div>
  );
}