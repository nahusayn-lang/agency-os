import { requireUserProfile } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import SidebarDesktop from "@/components/sidebar-desktop";

export default async function Sidebar() {
  const profile = await requireUserProfile();
  const dashboardPath = getDashboardPathForRole(profile.role);

  const isFounder = profile.role === "super_admin";
  const showTasksLink = ["admin", "super_admin"].includes(profile.role || "");

  return (
    <SidebarDesktop
      dashboardPath={dashboardPath}
      isFounder={isFounder}
      showTasksLink={showTasksLink}
    />
  );
}