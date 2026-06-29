"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Check, Trash2 } from "lucide-react";
import Link from "next/link";
import { markAllNotificationsAsRead, getLatestNotifications, clearAllNotifications } from "@/lib/messages/actions";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    getLatestNotifications().then((data) => {
      if (Array.isArray(data)) setNotifications(data);
    });

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground focus:outline-none"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-80 rounded-md border border-border bg-popover p-2 shadow-md text-popover-foreground">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2 px-2">
            <span className="text-xs font-semibold">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-[10px] text-destructive hover:underline font-medium"
                >
                  <Trash2 className="h-3 w-3" /> Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No notifications.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-2 rounded text-xs transition-colors ${
                    n.is_read ? "opacity-60" : "bg-accent/40 font-medium"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold block">{n.title}</span>
                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={() => setIsOpen(false)}
                        className="text-primary hover:text-primary/80 shrink-0"
                      >
                        →
                      </Link>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5">{n.message}</p>
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    {new Date(n.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}