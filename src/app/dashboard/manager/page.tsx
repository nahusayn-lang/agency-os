import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeekStartDateString } from "@/lib/performance/week";
import { getFounderCommitmentForWeek } from "@/lib/founder-commitment/actions";
import { FounderCommitmentReadonly } from "@/components/dashboard/founder-commitment-readonly";
import { AttendanceCard } from "@/components/dashboard/attendance-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getTodayDateString } from "@/lib/auth/attendance";

export default async function ManagerDashboardPage() {
  const profile = await requireRole("admin");
  const weekStart = getWeekStartDateString();
  const commitment = await getFounderCommitmentForWeek(weekStart);

  const supabase = createClient();
  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from("users")
    .select("is_checked_in, last_checkin_at, shift_start, shift_end")
    .eq("id", profile.id)
    .single();

  const isCheckedIn = userRow?.is_checked_in ?? false;
  const lastCheckinAt = userRow?.last_checkin_at ?? null;
  const shiftStart = userRow?.shift_start ?? null;
  const shiftEnd = userRow?.shift_end ?? null;

  const today = getTodayDateString();
  const { data: todayAttendance } = await admin
    .from("attendance")
    .select("id")
    .eq("user_id", profile.id)
    .eq("date", today)
    .maybeSingle();

  const checkedOutToday = !isCheckedIn && !!todayAttendance;

  const { data: members } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("role", "member")
    .eq("is_active", true)
    .order("name");

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AttendanceCard
          isCheckedIn={isCheckedIn}
          lastCheckinAt={lastCheckinAt}
          shiftStart={shiftStart}
          shiftEnd={shiftEnd}
          checkedOutToday={checkedOutToday}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingTasks ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeLeads ?? 0}</div></CardContent>
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
              <Link href={`/dashboard/team/${member.id}`} className="text-sm font-medium hover:underline">
                {member.name}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">{member.email}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}