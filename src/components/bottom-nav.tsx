"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, CheckSquare, BookUser, CalendarCheck } from "lucide-react";

const EDGE_ZONE_PX = 32; // how close to the bottom edge counts as a trigger
const SWIPE_UP_THRESHOLD_PX = 24; // minimum upward touch movement to count as "swipe up"
const AUTO_HIDE_MS = 3000; // hides itself again after this long with no interaction

export default function BottomNav({
  dashboardPath,
  showTasksLink,
}: {
  dashboardPath: string;
  showTasksLink: boolean;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const items = [
    { href: dashboardPath, label: "Dashboard", icon: LayoutDashboard, match: dashboardPath },
    ...(showTasksLink
      ? [{ href: "/tasks", label: "Tasks", icon: ClipboardList, match: "/tasks" }]
      : []),
    { href: "/my-tasks", label: "My Tasks", icon: CheckSquare, match: "/my-tasks" },
    { href: "/crm", label: "CRM", icon: BookUser, match: "/crm" },
    { href: "/attendance", label: "Attendance", icon: CalendarCheck, match: "/attendance" },
  ];

  // Shows the nav and (re)starts the auto-hide countdown. Called on every
  // trigger (swipe-up, mouse-near-bottom, or touching the nav itself) so
  // interacting with it keeps it alive instead of vanishing mid-tap.
  function showNav() {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }

  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      const y = e.touches[0]?.clientY ?? 0;
      const nearBottom = window.innerHeight - y < EDGE_ZONE_PX * 2;
      touchStartYRef.current = nearBottom ? y : null;
    }

    function handleTouchMove(e: TouchEvent) {
      if (touchStartYRef.current == null) return;
      const y = e.touches[0]?.clientY ?? 0;
      if (touchStartYRef.current - y > SWIPE_UP_THRESHOLD_PX) {
        showNav();
        touchStartYRef.current = null;
      }
    }

    function handleTouchEnd() {
      touchStartYRef.current = null;
    }

    function handleMouseMove(e: MouseEvent) {
      if (window.innerHeight - e.clientY < EDGE_ZONE_PX) {
        showNav();
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <nav
      onMouseEnter={showNav}
      onTouchStart={showNav}
      className={`fixed bottom-3 left-4 right-4 z-40 lg:left-[calc(16rem+1rem)] lg:right-4 lg:max-w-md lg:mx-auto
        flex items-center justify-around px-1 py-2
        transition-all duration-300 ease-out
        ${
          visible
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
    >
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = pathname === match || pathname?.startsWith(match + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-0.5 px-2 py-1 min-w-[52px]"
          >
            <Icon
              size={20}
              className={
                active
                  ? "text-violet-300 drop-shadow-[0_0_6px_rgba(196,132,252,0.6)]"
                  : "text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
              }
            />
            <span
              className={`text-[9px] leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
                active ? "text-violet-300 font-medium" : "text-white/80"
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