import { requireRole } from "@/lib/auth/session";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeekStartDateString } from "@/lib/performance/week";
import { getFounderCommitmentForWeek } from "@/lib/founder-commitment/actions";
import { WeeklyCommitmentCard } from "@/components/dashboard/weekly-commitment-card";
import { TeamProfilesList } from "@/components/dashboard/team-profiles-list";
import { AttendanceCard } from "@/components/dashboard/attendance-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getTodayDateString } from "@/lib/auth/attendance";
import { getFineAmount, closeStaleShiftSession } from "@/lib/services/strike-fine-engine";
import { getGlobalOffDayInfo } from "@/lib/services/attendance-settings";

export default async function ManagerDashboardPage() {
  const profile = await requireRole("admin");

  // Writes to the DB (auto-checkout for stale sessions) — must finish
  // before we read is_checked_in below, so this stays sequential.
  await closeStaleShiftSession(profile.id);

  const weekStart = getWeekStartDateString();
  const today = getTodayDateString();

  const supabase = createClient();
  const admin = createAdminClient();

  // All of these are independent of each other — fetch them in parallel
  // instead of one-by-one.
  const [
    commitment,
    userRowResult,
    todayAttendanceResult,
    teamMembersResult,
    pendingTasksResult,
    totalLeadsResult,
    activeLeadsResult,
    dealsClosedResult,
    wonLeadsResult,
    lostDealsResult,
    myFinesResult,
    activeStrikeCountResult,
    orgFinesResult,
    fineAmount,
    offDayInfo,
  ] = await Promise.all([
    getFounderCommitmentForWeek(weekStart),
    admin
      .from("users")
      .select("is_checked_in, last_checkin_at, shift_start, shift_end, checkout_report_pending")
      .eq("id", profile.id)
      .single(),
    admin
      .from("attendance")
      .select("id, checkout_time")
      .eq("user_id", profile.id)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, name, email, role")
      .in("role", ["member", "admin"])
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("completed","approved")'),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .not("stage", "in", '("deal_won","deal_lost")'),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "deal_won"),
    supabase.from("leads").select("deal_value").eq("stage", "deal_won"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "deal_lost"),
    admin
      .from("fines")
      .select("id, amount, status, deadline, proof_url, payment_comment")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    admin
      .from("strikes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_removed", false)
      .is("fine_id", null),
    admin.from("fines").select("id, status"),
    getFineAmount(),
    getGlobalOffDayInfo(today),
  ]);

  const userRow = userRowResult.data;
  const isCheckedIn = userRow?.is_checked_in ?? false;
  const reportPending = userRow?.checkout_report_pending ?? false;
  const lastCheckinAt = userRow?.last_checkin_at ?? null;

  const todayAttendance = todayAttendanceResult.data;
  // "Marked for today" should only show once checkout has actually
  // happened — a row simply existing isn't enough (an absent-marked row
  // also exists with "date = today", but its checkout_time is null).
  const checkedOutToday = !isCheckedIn && !!todayAttendance?.checkout_time;

  const teamMembers = teamMembersResult.data;
  const pendingTasks = pendingTasksResult.count;
  const totalLeads = totalLeadsResult.count;
  const activeLeads = activeLeadsResult.count;
  const dealsClosed = dealsClosedResult.count;
  const wonLeads = wonLeadsResult.data;
  const revenueGenerated = (wonLeads ?? []).reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
  const lostDeals = lostDealsResult.count;

  const myFines = myFinesResult.data;
  const activeStrikeCount = activeStrikeCountResult.count;
  const pendingFineCount = (myFines ?? []).filter(
    (f) => f.status === "pending" || f.status === "submitted"
  ).length;

  // For the Total Fines card — data for the whole team/org (not just your own).
  const orgFines = orgFinesResult.data;
  const orgFineCount = (orgFines ?? []).length;
  const orgPendingFineCount = (orgFines ?? []).filter(
    (f) => f.status === "pending" || f.status === "submitted"
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getRoleDisplayName("admin")} Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome, {profile.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <AttendanceCard
          isCheckedIn={isCheckedIn}
          offDayReason={offDayInfo.reason}
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
              <CardTitle className="text-sm font-medium">Total Fines</CardTitle>
              {orgPendingFineCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-medium px-2.5 py-0.5">
                  {orgPendingFineCount} pending
                </span>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orgFineCount}</div>
            </CardContent>
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


      <TeamProfilesList members={teamMembers ?? []} />
    </div>
  );
}