"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BlockedTask {
  id: string;
  title: string;
  status: string;
}

interface AttendanceCardProps {
  isCheckedIn: boolean;
  lastCheckinAt: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  checkedOutToday?: boolean;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function fmtShiftTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function AttendanceCard({ isCheckedIn, lastCheckinAt, shiftStart, shiftEnd, checkedOutToday }: AttendanceCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockedTasks, setBlockedTasks] = useState<BlockedTask[]>([]);
  const [elapsed, setElapsed] = useState<string>("0h 00m 00s");

  useEffect(() => {
    if (!isCheckedIn || !lastCheckinAt) return;
    const checkinTime = new Date(lastCheckinAt).getTime();
    const tick = () => {
      const diff = Date.now() - checkinTime;
      setElapsed(formatDuration(diff));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isCheckedIn, lastCheckinAt]);

  function handleCheckin() {
    setError(null);
    setBlockedTasks([]);
    startTransition(async () => {
      const res = await fetch("/api/attendance/checkin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Check-in failed.");
      } else {
        router.refresh();
      }
    });
  }

  function handleCheckout() {
    setError(null);
    setBlockedTasks([]);
    startTransition(async () => {
      const res = await fetch("/api/attendance/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "checkout_blocked" && data.blockedTasks) {
          setBlockedTasks(data.blockedTasks);
        } else {
          setError(data.error ?? "Check-out failed.");
        }
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card className={`border-2 ${isCheckedIn ? "border-emerald-500/40 bg-emerald-950/20" : checkedOutToday ? "border-emerald-500/20" : "border-border"}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Attendance</CardTitle>
        {isCheckedIn && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">

        {(shiftStart || shiftEnd) && (
          <p className="text-xs text-muted-foreground">
            Shift{" "}
            <span className="text-foreground font-medium">{fmtShiftTime(shiftStart)}</span>
            {" — "}
            <span className="text-foreground font-medium">{fmtShiftTime(shiftEnd)}</span>
          </p>
        )}

        {isCheckedIn ? (
          <>
            <div>
              <p className="text-3xl font-bold tabular-nums text-emerald-400">{elapsed}</p>
              <p className="text-xs text-muted-foreground mt-1">Time since check-in</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={handleCheckout}
              className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              {pending ? "Checking out…" : "Check Out"}
            </Button>
          </>
        ) : checkedOutToday ? (
          <p className="text-sm text-emerald-400 font-medium">Attendance marked for today ✓</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">You are not checked in today.</p>
            <Button
              size="sm"
              disabled={pending}
              onClick={handleCheckin}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {pending ? "Checking in…" : "Check In"}
            </Button>
          </>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {blockedTasks.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
            <p className="text-xs font-medium text-destructive">
              Cannot check out — resolve these tasks first:
            </p>
            <ul className="space-y-1">
              {blockedTasks.map((t) => (
                <li key={t.id} className="text-xs text-muted-foreground flex justify-between">
                  <span>{t.title}</span>
                  <span className="capitalize text-destructive/80">{t.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}