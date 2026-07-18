import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { LayoutDashboard, ClipboardList, CheckSquare, BookUser, CalendarCheck } from "lucide-react";

export default async function TopNav() {
  const profile = await requireUserProfile();
  const dashboardPath = getDashboardPathForRole(profile.role);
  const showTasksLink = ["admin", "super_admin"].includes(profile.role || "");

  const linkClass =
    "hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/10 transition-colors";

  return (
    <div className="hidden lg:flex items-center gap-1 h-14 px-4 lg:ml-64 bg-gradient-to-r from-[#3a0d8f] via-[#5b18c9] to-[#7c1fd6] sticky top-0 z-40 shadow-lg shadow-black/30">
      <Link href={dashboardPath} className={linkClass}>
        <LayoutDashboard size={15} /> Dashboard
      </Link>
      {showTasksLink && (
        <Link href="/tasks" className={linkClass}>
          <ClipboardList size={15} /> Tasks
        </Link>
      )}
      <Link href="/my-tasks" className={linkClass}>
        <CheckSquare size={15} /> My Tasks
      </Link>
      <Link href="/crm" className={linkClass}>
        <BookUser size={15} /> CRM
      </Link>
      <Link href="/attendance" className={linkClass}>
        <CalendarCheck size={15} /> Attendance
      </Link>
    </div>
  );
}