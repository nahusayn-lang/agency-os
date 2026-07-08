"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Check, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  markAllNotificationsAsRead,
  markNotificationReadAction,
  getLatestNotifications,
  clearAllNotifications,
  deleteNotificationAction,
  updateLeaveRequestStatusAction,
} from "@/lib/messages/actions";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
  created_at: string;
  type?: string | null;
  reference_id?: string | null;
}

// Notifications whose reference_id points to a `messages` row that can be
// approved/rejected inline (real leave requests + emergency checkouts both
// use this type).
const ACTIONABLE_TYPES = new Set(["leave_request"]);

function SwipeableRow({
  notification,
  onDelete,
  onOpen,
}: {
  notification: Notification;
  onDelete: (id: string) => void;
  onOpen: (n: Notification) => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [removing, setRemoving] = useState(false);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);
  const [pendingAction, setPendingAction] = useState<"approved" | "rejected" | null>(null);

  const DELETE_THRESHOLD = -70;

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    dragging.current = true;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    // Only allow swiping left (negative), clamp the range.
    setDragX(Math.max(-120, Math.min(0, delta)));
  }

  function handlePointerUp() {
    dragging.current = false;
    if (dragX < DELETE_THRESHOLD) {
      setRemoving(true);
      setDragX(-400);
      setTimeout(() => onDelete(notification.id), 180);
    } else {
      setDragX(0);
    }
    startX.current = null;
  }

  async function handleAction(status: "approved" | "rejected") {
    if (!notification.reference_id) return;
    setPendingAction(status);
    const res = await updateLeaveRequestStatusAction(notification.reference_id, status);
    if (!res?.error) {
      setRemoving(true);
      setTimeout(() => onDelete(notification.id), 180);
    } else {
      setPendingAction(null);
    }
  }

  const isActionable =
    notification.type &&
    ACTIONABLE_TYPES.has(notification.type) &&
    notification.reference_id;

  return (
    <div className="relative overflow-hidden rounded">
      {/* Delete backdrop revealed on swipe */}
      <div className="absolute inset-0 flex items-center justify-end bg-destructive px-3 rounded">
        <Trash2 className="h-4 w-4 text-destructive-foreground" />
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging.current ? "none" : "transform 180ms ease",
          opacity: removing ? 0 : 1,
        }}
        className={`relative p-2 rounded text-xs bg-popover touch-pan-y ${
          notification.is_read ? "opacity-60" : "bg-accent/40 font-medium"
        }`}
      >
        <div
          className="flex justify-between items-start gap-2 cursor-pointer"
          onClick={() => onOpen(notification)}
        >
          <span className="font-semibold block break-words">{notification.title}</span>
          {notification.link && (
            <Link
              href={notification.link}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(notification);
              }}
              className="text-primary hover:text-primary/80 shrink-0"
            >
              →
            </Link>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5">{notification.message}</p>
        <span className="text-[10px] text-muted-foreground block mt-1">
          {new Date(notification.created_at).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>

        {isActionable && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-border">
            <button
              disabled={pendingAction !== null}
              onClick={(e) => {
                e.stopPropagation();
                handleAction("approved");
              }}
              className="flex items-center gap-1 bg-green-600 text-white text-[10px] font-semibold px-2 py-1 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {pendingAction === "approved" && <Loader2 className="h-3 w-3 animate-spin" />}
              Approve
            </button>
            <button
              disabled={pendingAction !== null}
              onClick={(e) => {
                e.stopPropagation();
                handleAction("rejected");
              }}
              className="flex items-center gap-1 bg-destructive text-destructive-foreground text-[10px] font-semibold px-2 py-1 rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {pendingAction === "rejected" && <Loader2 className="h-3 w-3 animate-spin" />}
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
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

    return () => {
      supabase.removeChannel(channel);
    };
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
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const res = await markAllNotificationsAsRead();
    if (res?.error) {
      getLatestNotifications().then((data) => Array.isArray(data) && setNotifications(data));
    }
  };

  // Optimistic clear: wipe the list instantly, roll back only if the
  // server call actually fails. This is what was making "Clear all" feel stuck.
  const handleClearAll = async () => {
    const previous = notifications;
    setClearing(true);
    setNotifications([]);
    const res = await clearAllNotifications();
    setClearing(false);
    if (res?.error) {
      setNotifications(previous);
    }
  };

  const handleDelete = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotificationAction(id).catch(() => {
      // Silent fail is fine here — worst case it reappears on next refresh.
    });
  }, []);

  const handleOpen = useCallback((n: Notification) => {
    setIsOpen(false);
    if (!n.is_read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      markNotificationReadAction(n.id).catch(() => {});
    }
  }, []);

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
                  disabled={clearing}
                  className="flex items-center gap-1 text-[10px] text-destructive hover:underline font-medium disabled:opacity-50"
                >
                  {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No notifications.
              </div>
            ) : (
              notifications.map((n) => (
                <SwipeableRow key={n.id} notification={n} onDelete={handleDelete} onOpen={handleOpen} />
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <p className="text-[9px] text-muted-foreground text-center mt-2 pt-1 border-t border-border">
              Swipe left to remove a notification
            </p>
          )}
        </div>
      )}
    </div>
  );
}