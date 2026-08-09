import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { NotificationBell } from "@/components/notification-bell";
import Sidebar from "@/components/sidebar";
import SidebarClient from "@/components/sidebar-client";
import BottomNav from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { getTodayDateString } from "@/lib/auth/attendance";

function formatDisplayName(name?: string | null, email?: string | null) {
  if (name && name.trim() !== "") return name;
  if (!email) return "";
  const prefix = email.split("@")[0] || email;
  return prefix
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function Header() {
  const profile = await requireUserProfile();
  const dashboardPath = getDashboardPathForRole(profile.role);
  const displayName = formatDisplayName(profile.name, profile.email || null);

  const showTasksLink = ["admin", "super_admin"].includes(profile.role || "");

  const supabase = createClient();
  const today = getTodayDateString();
  const { data: coldCallTask } = await supabase
    .from("tasks")
    .select("status, mandatory_target_count")
    .eq("assigned_to", profile.id)
    .eq("is_mandatory", true)
    .eq("mandatory_type", "cold_calls")
    .eq("mandatory_date", today)
    .maybeSingle();

  const coldCallSubmitted = coldCallTask
    ? !["pending", "in_progress", "paused", "revision_required"].includes(coldCallTask.status)
    : false;

  return (
    <>
      <Sidebar />
      <header className="glass-card rounded-none border-x-0 border-t-0 lg:ml-64 sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <SidebarClient profile={{ id: profile.id, name: displayName, role: profile.role, email: profile.email, dashboardPath }} />
            <Link href={dashboardPath} className="text-sm font-semibold text-white lg:hidden">
              Agency OS
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell userId={profile.id} />
            <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center">
              <span className="text-violet-300 text-xs font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-white/50 hidden sm:block">{displayName}</span>
          </div>
        </div>
      </header>

      {coldCallTask && !coldCallSubmitted && (
        <div className="lg:ml-64 sticky top-14 z-20 relative overflow-hidden border-b border-red-500/30 bg-red-950/60 px-3 py-1.5">
          <div className="cold-call-shine" />
          <p className="relative mx-auto flex max-w-7xl items-center justify-center gap-1.5 truncate text-center text-sm font-semibold tracking-wide text-red-300">
            <svg
              className="cold-call-ring h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z" />
            </svg>
            {`${coldCallTask.mandatory_target_count} Cold Calls pending — submit now`}
          </p>
        </div>
      )}

      <BottomNav dashboardPath={dashboardPath} showTasksLink={showTasksLink} />
    </>
  );
}