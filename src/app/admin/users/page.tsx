import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { UsersList } from "@/components/admin/user-row-list";
import { HolidaySettings } from "@/components/dashboard/holiday-settings";
import { ColdCallSettings } from "@/components/dashboard/cold-call-settings";
import { getSundayOffSetting, listHolidays } from "@/lib/services/attendance-settings";
import { getDefaultColdCallTarget, listColdCallTargets } from "@/lib/services/cold-call-settings";

export default async function AdminUsersPage() {
  const profile = await requireUserProfile();
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Admin Users</h1>
        <p className="text-sm text-muted-foreground">You are not authorized to view this page.</p>
      </div>
    );
  }

  const supabase = createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, is_active, shift_start, shift_end")
    .order("name");

  const rows = (users ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    shift_start?: string | null;
    shift_end?: string | null;
  }>;

  const isSuperAdmin = profile.role === "super_admin";
  const sundayOff = isSuperAdmin ? await getSundayOffSetting() : true;
  const holidays = isSuperAdmin ? await listHolidays() : [];
  const defaultColdCallTarget = isSuperAdmin ? await getDefaultColdCallTarget() : 15;
  const coldCallMembers = isSuperAdmin ? await listColdCallTargets() : [];

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="mb-6 text-2xl font-bold">Admin Users</h1>

      {isSuperAdmin && (
        <div className="mb-6 space-y-4">
          <HolidaySettings initialSundayOff={sundayOff} initialHolidays={holidays} />
          <ColdCallSettings initialDefaultTarget={defaultColdCallTarget} initialMembers={coldCallMembers} />
        </div>
      )}

      <UsersList rows={rows} isSuperAdmin={isSuperAdmin} />

      <div className="mt-6">
        <Link
          href="/admin/users"
          className="text-sm text-primary underline underline-offset-2"
        >
          Refresh
        </Link>
      </div>
    </div>
  );
}