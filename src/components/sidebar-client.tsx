"use client";
import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { LayoutDashboard, ClipboardList, CheckSquare, BookUser, Mail, FileText, CalendarCheck, BarChart2, Target, Users, X, Menu } from "lucide-react";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types/database";

export default function SidebarClient({ profile }: { profile: { id: string; name: string; role: string; email?: string } }) {
  const [open, setOpen] = useState(false);

  const isAdmin = ["super_admin", "admin"].includes(profile.role || "");
  const showTasksLink = ["admin", "super_admin"].includes(profile.role || "");
  const dashboardPath = getDashboardPathForRole(profile.role as UserRole);

  const linkClass = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/80 hover:bg-indigo-500/10 transition-colors";

  const close = () => setOpen(false);

  return (
    <>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-white/5 lg:hidden text-white/60"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#0d0d12] border-r border-white/[0.06] flex flex-col">

            <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-indigo-300 text-xs font-bold">A</span>
                </div>
                <Link href={dashboardPath} onClick={close} className="text-sm font-semibold text-white">
                  Agency OS
                </Link>
              </div>
              <button aria-label="Close menu" onClick={close} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40">
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Main</p>
              <Link href={dashboardPath} onClick={close} className={linkClass}>
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              {showTasksLink && (
                <Link href="/tasks" onClick={close} className={linkClass}>
                  <ClipboardList size={15} /> Tasks
                </Link>
              )}
              <Link href="/my-tasks" onClick={close} className={linkClass}>
                <CheckSquare size={15} /> My Tasks
              </Link>
              <Link href="/crm" onClick={close} className={linkClass}>
                <BookUser size={15} /> CRM
              </Link>
              <Link href="/messages" onClick={close} className={linkClass}>
                <Mail size={15} /> Messages
              </Link>
              <Link href="/reports" onClick={close} className={linkClass}>
                <FileText size={15} /> Reports
              </Link>

              <div className="border-t border-white/[0.06] my-3" />

              <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Tracking</p>
              <Link href="/attendance" onClick={close} className={linkClass}>
                <CalendarCheck size={15} /> Attendance
              </Link>
              <Link href="/performance" onClick={close} className={linkClass}>
                <BarChart2 size={15} /> Performance
              </Link>
              <Link href="/targets" onClick={close} className={linkClass}>
                <Target size={15} /> Weekly Targets
              </Link>

              {isAdmin && (
                <>
                  <div className="border-t border-white/[0.06] my-3" />
                  <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Admin</p>
                  <Link href="/admin/users" onClick={close} className={linkClass}>
                    <Users size={15} /> Users
                  </Link>
                </>
              )}
            </nav>

            <div className="px-3 py-4 border-t border-white/[0.06]">
              <LogoutButton />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}