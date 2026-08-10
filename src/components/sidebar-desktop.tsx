"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { LogoutButton } from "@/components/logout-button";
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  BookUser,
  Mail,
  FileText,
  CalendarCheck,
  BarChart2,
  Target,
  Users,
  Wallet,
  ChevronsRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const STORAGE_KEY = "agencyos_sidebar_collapsed";

function NavLink({
  href,
  icon: Icon,
  label,
  collapsed,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center h-11 rounded-lg text-sm text-white/40 hover:text-white/80 hover:bg-violet-500/10 transition-colors ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      }`}
    >
      <Icon size={15} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

interface SidebarDesktopProps {
  dashboardPath: string;
  isFounder: boolean;
  showTasksLink: boolean;
}

export default function SidebarDesktop({ dashboardPath, isFounder, showTasksLink }: SidebarDesktopProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore the saved preference after mount (avoids SSR/client mismatch)
  // and keep the shared --sidebar-w CSS var (used by header/main offsets)
  // in sync so content never overlaps the sidebar.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? "4rem" : "16rem");
    if (mounted) localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, mounted]);

  return (
    <aside
      className={`sidebar-glass hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 lg:rounded-none lg:border-y-0 lg:border-l-0 transition-[width] duration-300 ease-in-out ${
        collapsed ? "lg:w-16" : "lg:w-64"
      }`}
    >
      <div className="flex flex-col h-full">
        <div
          className={`flex items-center h-14 border-b border-white/10 ${
            collapsed ? "justify-center px-2" : "gap-3 px-4"
          }`}
        >
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
            <span className="text-violet-300 text-xs font-bold">A</span>
          </div>
          {!collapsed && (
            <Link href={dashboardPath} className="text-sm font-semibold text-white truncate">
              Agency OS
            </Link>
          )}
        </div>

        <nav className={`scrollbar-hide flex-1 py-4 space-y-1 overflow-y-auto ${collapsed ? "px-2" : "px-3"}`}>
          {!collapsed && (
            <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Main</p>
          )}
          <NavLink href={dashboardPath} icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />
          {showTasksLink && (
            <NavLink href="/tasks" icon={ClipboardList} label="Tasks" collapsed={collapsed} />
          )}
          <NavLink href="/my-tasks" icon={CheckSquare} label="My Tasks" collapsed={collapsed} />
          <NavLink href="/crm" icon={BookUser} label="CRM" collapsed={collapsed} />
          <NavLink href="/messages" icon={Mail} label="Messages" collapsed={collapsed} />
          <NavLink href="/reports" icon={FileText} label="Reports" collapsed={collapsed} />

          <div className="border-t border-white/10 my-3" />

          {!collapsed && (
            <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Tracking</p>
          )}
          <NavLink href="/attendance" icon={CalendarCheck} label="Attendance" collapsed={collapsed} />
          <NavLink href="/performance" icon={BarChart2} label="Performance" collapsed={collapsed} />
          <NavLink href="/fines-rewards" icon={Wallet} label="Fine & Rewards" collapsed={collapsed} />
          <NavLink href="/targets" icon={Target} label="Weekly Targets" collapsed={collapsed} />

          {isFounder && (
            <>
              <div className="border-t border-white/10 my-3" />
              {!collapsed && (
                <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pb-1">Admin</p>
              )}
              <NavLink href="/admin/users" icon={Users} label="Users" collapsed={collapsed} />
            </>
          )}
        </nav>

        <div className={`border-t border-white/10 py-4 ${collapsed ? "px-2" : "px-3"}`}>
          {collapsed ? (
            <form action={logoutAction}>
              <button
                type="submit"
                title="Log out"
                aria-label="Log out"
                className="flex items-center justify-center w-full h-9 rounded-md text-white/40 hover:text-white/80 hover:bg-violet-500/10 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </form>
          ) : (
            <LogoutButton />
          )}
        </div>

        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center h-11 border-t border-white/10 text-white/40 hover:text-white/80 hover:bg-violet-500/10 transition-colors ${
            collapsed ? "justify-center px-0" : "gap-3 px-4"
          }`}
        >
          <ChevronsRight
            size={15}
            className={`shrink-0 transition-transform duration-300 ${!collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}