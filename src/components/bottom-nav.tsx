"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, CheckSquare, BookUser, CalendarCheck } from "lucide-react";

export default function BottomNav({
  dashboardPath,
  showTasksLink,
}: {
  dashboardPath: string;
  showTasksLink: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { href: dashboardPath, label: "Dashboard", icon: LayoutDashboard, match: dashboardPath },
    ...(showTasksLink
      ? [{ href: "/tasks", label: "Tasks", icon: ClipboardList, match: "/tasks" }]
      : []),
    { href: "/my-tasks", label: "My Tasks", icon: CheckSquare, match: "/my-tasks" },
    { href: "/crm", label: "CRM", icon: BookUser, match: "/crm" },
    { href: "/attendance", label: "Attendance", icon: CalendarCheck, match: "/attendance" },
  ];

  return (
    <nav
      className="fixed bottom-3 left-4 right-4 z-40 lg:left-[calc(16rem+1rem)] lg:right-4 lg:max-w-md lg:mx-auto
        flex items-center justify-around rounded-2xl border border-violet-400/[0.18]
        bg-[#1e0f46]/55 backdrop-blur-xl shadow-lg shadow-black/30 px-1 py-2"
    >
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = pathname === match || pathname?.startsWith(match + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-0.5 px-2 py-1 min-w-[52px]"
          >
            <Icon size={18} className={active ? "text-violet-300" : "text-white/40"} />
            <span
              className={`text-[9px] leading-none ${
                active ? "text-violet-300 font-medium" : "text-white/40"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}