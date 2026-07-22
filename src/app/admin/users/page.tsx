import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { UsersList } from "@/components/admin/user-row-list";
import { HolidaySettings } from "@/components/dashboard/holiday-settings";
import { getSundayOffSetting, listHolidays } from "@/lib/services/attendance-settings";

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

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="mb-6 text-2xl font-bold">Admin Users</h1>

      {isSuperAdmin && (
        <div className="mb-6">
          <HolidaySettings initialSundayOff={sundayOff} initialHolidays={holidays} />
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