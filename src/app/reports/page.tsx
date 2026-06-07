import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CreateReportForm } from "@/components/reports/create-report-form";
import { ReportsList } from "@/components/reports/reports-list";
import { AdminReportsView } from "@/components/reports/admin-reports-view";
import { CreateWeeklyTargetForm } from "@/components/weekly-targets/create-weekly-target-form";
import { WeeklyTargetsList } from "@/components/weekly-targets/weekly-targets-list";
import { AdminWeeklyTargetsView } from "@/components/weekly-targets/admin-weekly-targets-view";
import { getWeeklyTargetsForMember, getAllWeeklyTargetsForAdmin } from "@/lib/weekly-targets/actions";

export default async function ReportsPage() {
  const profile = await requireUserProfile();
  const supabase = createClient();
  const isMember = profile.role === "member";

  let weeklyTargets = [];
  if (isMember) {
    weeklyTargets = await getWeeklyTargetsForMember(profile.id);
  } else {
    weeklyTargets = await getAllWeeklyTargetsForAdmin();
  }

  let teamMembers: Array<{ id: string; name: string }> = [];
  if (!isMember) {
    const { data: members } = await supabase.from("users").select("id, name").eq("role", "member").eq("is_active", true).order("name");
    teamMembers = members ?? [];
  }

  return (
    <div className="space-y-12">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/targets" className="hover:underline">Targets</Link>
        <Link href="/performance" className="hover:underline">Performance</Link>
        <Link href="/attendance" className="hover:underline">Attendance</Link>
        {!isMember && <Link href="/admin/users" className="hover:underline">Admin Users</Link>}
      </div>
      <section>
        <h2 className="mb-6 text-2xl font-bold">Daily Reports</h2>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1"><CreateReportForm /></div>
          <div className="lg:col-span-2"><ReportsList userId={profile.id} /></div>
        </div>
      </section>

      {!isMember && (
        <section>
          <h2 className="mb-6 text-2xl font-bold">Team Reports Review</h2>
          <AdminReportsView />
        </section>
      )}

      <section>
        <h2 className="mb-6 text-2xl font-bold">Weekly Targets</h2>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">{!isMember && <CreateWeeklyTargetForm teamMembers={teamMembers} />}</div>
          <div className="lg:col-span-2">{isMember ? <WeeklyTargetsList targets={weeklyTargets} isMemberView /> : <AdminWeeklyTargetsView targets={weeklyTargets} />}</div>
        </div>
      </section>
    </div>
  );
}
