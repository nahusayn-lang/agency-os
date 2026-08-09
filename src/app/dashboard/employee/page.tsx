import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { getWeekStartDateString } from "@/lib/performance/week";
import { getFounderCommitmentForWeek } from "@/lib/founder-commitment/actions";
import { FounderCommitmentReadonly } from "@/components/dashboard/founder-commitment-readonly";
import { getLatestPerformanceScoreForUser } from "@/lib/performance/actions";
import { PerformanceScoreSection } from "@/components/performance/performance-score-section";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AttendanceCard } from "@/components/dashboard/attendance-card";
import {
  ColdCallsIllustration,
  TasksIllustration,
  WeeklyTargetIllustration,
  PerformanceIllustration,
} from "@/components/dashboard/stat-illustrations";
import { getTodayDateString } from "@/lib/auth/attendance";
import { getFineAmount, closeStaleShiftSession } from "@/lib/services/strike-fine-engine";
import { getGlobalOffDayInfo } from "@/lib/services/attendance-settings";

export default async function EmployeeDashboardPage() {
  const profile = await requireRole("member");

  // Writes to the DB (auto-checkout for stale sessions) — must finish
  // before we read is_checked_in below, so this stays sequential.
  await closeStaleShiftSession(profile.id);

  const weekStart = getWeekStartDateString();
  const today = getTodayDateString();
  const startOfWeek = new Date(weekStart);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const supabase = createClient();
  const admin = createAdminClient();

  // All of these are independent of each other — fetch them in parallel
  // instead of one-by-one.
  // Note: the old "unread notifications count" query was fetched but its
  // result was never used anywhere — removed, it was a wasted DB round trip.
  const [
    commitment,
    ownScore,
    userRowResult,
    todayAttendanceResult,
    todaysTasksResult,
    targetsResult,
    myFinesResult,
    activeStrikeCountResult,
    fineAmount,
    offDayInfo,
    coldCallTaskResult,
  ] = await Promise.all([
    getFounderCommitmentForWeek(weekStart),
    getLatestPerformanceScoreForUser(profile.id),
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
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", profile.id)
      .not("status", "in", '("completed","approved")'),
    supabase
      .from("weekly_targets")
      .select("completion_percentage")
      .eq("user_id", profile.id)
      .gte("created_at", startOfWeek.toISOString())
      .lt("created_at", endOfWeek.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
    getFineAmount(),
    getGlobalOffDayInfo(today),
    supabase
      .from("tasks")
      .select("id, status, mandatory_target_count, mandatory_actual_count, mandatory_type")
      .eq("assigned_to", profile.id)
      .eq("is_mandatory", true)
      .eq("mandatory_date", today)
      .maybeSingle(),
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

  const todaysTasks = todaysTasksResult.count;

  const targets = targetsResult.data;
  const weeklyTargetPercent = targets?.completion_percentage ?? 0;

  const myFines = myFinesResult.data;
  const activeStrikeCount = activeStrikeCountResult.count;
  const pendingFineCount = (myFines ?? []).filter(
    (f) => f.status === "pending" || f.status === "submitted"
  ).length;

  const coldCallTask = coldCallTaskResult.data;
  const coldCallSubmitted = coldCallTask
    ? !["pending", "in_progress", "paused", "revision_required"].includes(coldCallTask.status)
    : false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getRoleDisplayName("member")} Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome, {profile.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        {coldCallTask && (
          <Link href="/my-tasks">
            <Card
              className={`transition-colors hover:bg-muted/40 ${
                coldCallSubmitted
                  ? "border-l-4 border-l-green-500"
                  : "border-l-4 border-l-fuchsia-500"
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="relative z-10 text-sm font-medium">
                  Cold Calls {coldCallSubmitted ? "· Submitted" : "· Mandatory"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ColdCallsIllustration className="absolute right-1 bottom-0 h-20 w-20 opacity-90 pointer-events-none" />
                <div className="relative z-10 text-2xl font-bold">
                  {coldCallTask.mandatory_actual_count ?? 0}
                  <span className="text-base text-muted-foreground">
                    {" "}
                    / {coldCallTask.mandatory_target_count} target
                  </span>
                </div>
                {!coldCallSubmitted && (
                  <p className="relative z-10 mt-1 text-xs text-muted-foreground">
                    Submit before checkout — screenshot required.
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="relative z-10 text-sm font-medium">Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksIllustration className="absolute right-1 bottom-0 h-20 w-20 opacity-90 pointer-events-none" />
            <div className="relative z-10 text-2xl font-bold">{todaysTasks ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="relative z-10 text-sm font-medium">Weekly Target %</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyTargetIllustration className="absolute right-3 top-2 h-9 w-9 opacity-20" />
            <div className="relative z-10 text-2xl font-bold">{weeklyTargetPercent}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="relative z-10 text-sm font-medium">Performance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceIllustration className="absolute right-3 top-2 h-9 w-9 opacity-20" />
            <div className="relative z-10 text-2xl font-bold">{ownScore?.total_score ?? "—"}</div>
          </CardContent>
        </Card>
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