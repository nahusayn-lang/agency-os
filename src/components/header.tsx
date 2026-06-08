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
  // replace dots/underscores/hyphens with spaces and capitalize words
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
      <header className="border-b border-border lg:ml-64">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            {/* Mobile hamburger (SidebarClient will handle opening on mobile) */}
            <SidebarClient profile={{ id: profile.id, name: displayName, role: profile.role, email: profile.email }} />
            <Link href={dashboardPath} className="text-sm font-medium tracking-tight">
              Agency OS
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell userId={profile.id} />
            <span className="text-sm text-muted-foreground">{displayName}</span>
          </div>
        </div>
      </header>
    </>
  );
}
