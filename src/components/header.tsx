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
      <header className="border-b border-violet-400/[0.12] bg-[#0e0526] lg:ml-64 sticky top-0 z-30">
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

      {coldCallTask && (
        <div className="lg:ml-64 sticky top-14 z-20 border-b border-red-500/20 bg-red-950/40 px-4 py-2">
          <p className="mx-auto max-w-7xl text-sm font-medium cold-call-shimmer-text">
            {coldCallSubmitted
              ? "✅ Cold calls done for today — great work!"
              : `📞 Cold Calls task pending — submit ${coldCallTask.mandatory_target_count} calls before checkout.`}
          </p>
        </div>
      )}

      <BottomNav dashboardPath={dashboardPath} showTasksLink={showTasksLink} />
    </>
  );
}