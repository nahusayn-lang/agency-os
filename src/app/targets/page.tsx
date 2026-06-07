import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CreateWeeklyTargetForm } from "@/components/weekly-targets/create-weekly-target-form";
import { WeeklyTargetsList } from "@/components/weekly-targets/weekly-targets-list";
import { AdminWeeklyTargetsView } from "@/components/weekly-targets/admin-weekly-targets-view";
import { getWeeklyTargetsForMember, getAllWeeklyTargetsForAdmin } from "@/lib/weekly-targets/actions";

export default async function TargetsPage() {
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
    <div>
      <h1 className="mb-6 text-2xl font-bold">Targets</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">{!isMember && <CreateWeeklyTargetForm teamMembers={teamMembers} />}</div>
        <div className="lg:col-span-2">{isMember ? <WeeklyTargetsList targets={weeklyTargets} isMemberView /> : <AdminWeeklyTargetsView targets={weeklyTargets} />}</div>
      </div>
    </div>
  );
}
