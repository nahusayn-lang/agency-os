import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { NotificationBell } from "@/components/notification-bell";
import Sidebar from "@/components/sidebar";
import SidebarClient from "@/components/sidebar-client";

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

  return (
    <>
      <Sidebar />
      <header className="border-b border-white/[0.06] bg-[#0d0d12] lg:ml-64 sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <SidebarClient profile={{ id: profile.id, name: displayName, role: profile.role, email: profile.email, dashboardPath }} />
            <Link href={dashboardPath} className="text-sm font-semibold text-white lg:hidden">
              Agency OS
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell userId={profile.id} />
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <span className="text-indigo-300 text-xs font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-white/50 hidden sm:block">{displayName}</span>
          </div>
        </div>
      </header>
    </>
  );
}