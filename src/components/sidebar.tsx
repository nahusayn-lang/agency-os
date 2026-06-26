import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/logout-button";
import { LayoutDashboard, ClipboardList, CheckSquare, BookUser, Mail, FileText, CalendarCheck, BarChart2, Target, Users } from "lucide-react";

export default async function Sidebar() {
  const profile = await requireUserProfile();
  const dashboardPath = getDashboardPathForRole(profile.role);

  const isFounder = profile.role === "super_admin";
  const showTasksLink = ["admin", "super_admin"].includes(profile.role || "");

  const linkClass = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/80 hover:bg-indigo-500/10 transition-colors";

  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:z-40 bg-[#0d0d12] border-r border-white/[0.06]">
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <span className="text-indigo-300 text-xs font-bold">A</span>
          </div>
          <Link href={dashboardPath} className="text-sm font-semibold text-white">
            Agency OS
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Main</p>
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
          <Link href="/messages" className={linkClass}>
            <Mail size={15} /> Messages
          </Link>
          <Link href="/reports" className={linkClass}>
            <FileText size={15} /> Reports
          </Link>

          <div className="border-t border-white/[0.06] my-3" />

          <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Tracking</p>
          <Link href="/attendance" className={linkClass}>
            <CalendarCheck size={15} /> Attendance
          </Link>
          <Link href="/performance" className={linkClass}>
            <BarChart2 size={15} /> Performance
          </Link>
          <Link href="/targets" className={linkClass}>
            <Target size={15} /> Weekly Targets
          </Link>

          {isFounder && (
            <>
              <div className="border-t border-white/[0.06] my-3" />
              <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Admin</p>
              <Link href="/admin/users" className={linkClass}>
                <Users size={15} /> Users
              </Link>
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-white/[0.06]">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}