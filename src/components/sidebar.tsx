import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/logout-button";

export default async function Sidebar() {
  const profile = await requireUserProfile();
  const dashboardPath = getDashboardPathForRole(profile.role);

  const isAdmin = ["super_admin", "founder"].includes(profile.role || "");

  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:py-6 lg:px-4 bg-background border-r">
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <Link href={dashboardPath} className="text-lg font-semibold">
            Agency OS
          </Link>
        </div>

        <nav className="flex-1 space-y-2 text-sm">
          <div className="flex flex-col space-y-1">
            <Link href={dashboardPath} className="px-2 py-1 rounded hover:bg-accent/5">Dashboard</Link>
            <Link href="/tasks" className="px-2 py-1 rounded hover:bg-accent/5">Tasks</Link>
            <Link href="/crm" className="px-2 py-1 rounded hover:bg-accent/5">CRM</Link>
            <Link href="/messages" className="px-2 py-1 rounded hover:bg-accent/5">Messages</Link>
            <Link href="/reports" className="px-2 py-1 rounded hover:bg-accent/5">Reports</Link>
          </div>

          <div className="border-t border-border my-3" />

          <div className="flex flex-col space-y-1">
            <Link href="/attendance" className="px-2 py-1 rounded hover:bg-accent/5">Attendance</Link>
            <Link href="/performance" className="px-2 py-1 rounded hover:bg-accent/5">Performance</Link>
            <Link href="/targets" className="px-2 py-1 rounded hover:bg-accent/5">Weekly Targets</Link>
          </div>

          <div className="border-t border-border my-3" />

          {isAdmin && (
            <div className="flex flex-col space-y-1">
              <Link href="/admin/users" className="px-2 py-1 rounded hover:bg-accent/5">Users</Link>
            </div>
          )}
        </nav>

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
