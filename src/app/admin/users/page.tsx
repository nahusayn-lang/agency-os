import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toggleUserActiveAction, setUserRoleAction, setShiftAction } from "@/lib/admin/users";

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
  const { data: users } = await supabase.from("users").select("id, name, email, role, is_active, shift_start, shift_end").order("name");
  const rows = (users ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    shift_start?: string | null;
    shift_end?: string | null;
  }>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin Users</h1>
      <div className="space-y-4">
        {rows.map((u) => (
          <div key={u.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-sm text-muted-foreground">{u.email} · {u.role}</div>
              </div>
              <div className="flex items-center gap-2">
                <form action={toggleUserActiveAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="isActive" value={u.is_active ? "false" : "true"} />
                  <button type="submit" className="btn">{u.is_active ? "Deactivate" : "Activate"}</button>
                </form>

                <form action={setUserRoleAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="role" defaultValue={u.role} className="border rounded px-2 py-1 bg-white text-black">
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                  <button type="submit" className="ml-2 btn">Set role</button>
                </form>
              </div>
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              Shift {u.shift_start ?? "—"} — {u.shift_end ?? "—"}
            </div>

            {profile.role === "super_admin" && (
              <form action={setShiftAction} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <input
                  type="time"
                  name="shift_start"
                  defaultValue={u.shift_start?.slice(0, 5) ?? "09:00"}
                  className="border rounded px-2 py-1 text-sm bg-white text-black"
                />
                <span className="text-sm">to</span>
                <input
                  type="time"
                  name="shift_end"
                  defaultValue={u.shift_end?.slice(0, 5) ?? "17:00"}
                  className="border rounded px-2 py-1 text-sm bg-white text-black"
                />
                <button type="submit" className="btn text-sm">Save shift</button>
              </form>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Link href="/admin/users">Refresh</Link>
      </div>
    </div>
  );
}