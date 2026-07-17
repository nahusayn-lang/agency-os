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

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="mb-6 text-2xl font-bold">Admin Users</h1>

      <div className="space-y-4">
        {profile.role === "super_admin" && (
          <a
            href="/fines-rewards"
            className="block rounded-xl border border-white/10 bg-card p-4 text-sm text-primary underline underline-offset-2"
          >
            Fine amount, strikes aur fines ab yahan hain → Fine &amp; Rewards page
          </a>
        )}
        {rows.map((u) => (
          <div key={u.id} className="rounded-xl border border-border bg-card p-4 space-y-3">

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-base truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                {u.role}
              </span>
            </div>

            <form action={toggleUserActiveAction}>
              <input type="hidden" name="userId" value={u.id} />
              <input type="hidden" name="isActive" value={u.is_active ? "false" : "true"} />
              <button
                type="submit"
                className={`w-full text-sm font-medium py-2 rounded-lg border transition-colors ${
                  u.is_active
                    ? "border-destructive text-destructive hover:bg-destructive hover:text-white"
                    : "border-green-500 text-green-600 hover:bg-green-500 hover:text-white"
                }`}
              >
                {u.is_active ? "Deactivate" : "Activate"}
              </button>
            </form>

            <form action={setUserRoleAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <select
                name="role"
                defaultValue={u.role}
                className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-sm text-foreground"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
              <button
                type="submit"
                className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Set role
              </button>
            </form>

            <div className="text-xs text-muted-foreground">
              Shift: {u.shift_start?.slice(0, 5) ?? "—"} → {u.shift_end?.slice(0, 5) ?? "—"}
            </div>

            {profile.role === "super_admin" && (
              <form action={setShiftAction} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <input
                  type="time"
                  name="shift_start"
                  defaultValue={u.shift_start?.slice(0, 5) ?? "09:00"}
                  className="flex-1 border border-border rounded-lg px-2 py-2 text-sm bg-background text-foreground"
                />
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <input
                  type="time"
                  name="shift_end"
                  defaultValue={u.shift_end?.slice(0, 5) ?? "17:00"}
                  className="flex-1 border border-border rounded-lg px-2 py-2 text-sm bg-background text-foreground"
                />
                <button
                  type="submit"
                  className="shrink-0 text-sm font-medium px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Save
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

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