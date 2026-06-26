"use client";
import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { LayoutDashboard, ClipboardList, CheckSquare, BookUser, Mail, FileText, CalendarCheck, BarChart2, Target, Users, X, Menu } from "lucide-react";

export default function SidebarClient({ profile }: { 
  profile: { id: string; name: string; role: string; email?: string; dashboardPath: string } 
}) {
  const [open, setOpen] = useState(false);

  const isFounder = profile.role === "super_admin";
  const showTasksLink = ["admin", "super_admin"].includes(profile.role || "");

  const linkClass = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/80 hover:bg-indigo-500/10 transition-colors";

  return (
    <>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-indigo-500/10 lg:hidden text-white/50 hover:text-white/80 transition-colors"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#0d0d12] border-r border-white/[0.06] flex flex-col">
            <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-indigo-300 text-xs font-bold">A</span>
                </div>
                <span className="text-sm font-semibold text-white">Agency OS</span>
              </div>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/80 transition-colors">
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Main</p>
              <Link href={profile.dashboardPath} onClick={() => setOpen(false)} className={linkClass}>
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              {showTasksLink && (
                <Link href="/tasks" onClick={() => setOpen(false)} className={linkClass}>
                  <ClipboardList size={15} /> Tasks
                </Link>
              )}
              <Link href="/my-tasks" onClick={() => setOpen(false)} className={linkClass}>
                <CheckSquare size={15} /> My Tasks
              </Link>
              <Link href="/crm" onClick={() => setOpen(false)} className={linkClass}>
                <BookUser size={15} /> CRM
              </Link>
              <Link href="/messages" onClick={() => setOpen(false)} className={linkClass}>
                <Mail size={15} /> Messages
              </Link>
              <Link href="/reports" onClick={() => setOpen(false)} className={linkClass}>
                <FileText size={15} /> Reports
              </Link>

              <div className="border-t border-white/[0.06] my-3" />

              <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Tracking</p>
              <Link href="/attendance" onClick={() => setOpen(false)} className={linkClass}>
                <CalendarCheck size={15} /> Attendance
              </Link>
              <Link href="/performance" onClick={() => setOpen(false)} className={linkClass}>
                <BarChart2 size={15} /> Performance
              </Link>
              <Link href="/targets" onClick={() => setOpen(false)} className={linkClass}>
                <Target size={15} /> Weekly Targets
              </Link>

              {isFounder && (
                <>
                  <div className="border-t border-white/[0.06] my-3" />
                  <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Admin</p>
                  <Link href="/admin/users" onClick={() => setOpen(false)} className={linkClass}>
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