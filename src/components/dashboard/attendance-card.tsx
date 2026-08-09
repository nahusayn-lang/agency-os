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
  /** If set, today is a company-wide off day (Sunday / holiday) — hides Check In. */
  offDayReason?: string | null;
  /** True if checkout was initiated but the mandatory report hasn't been submitted yet. */
  reportPending?: boolean;
  /** Active (not removed) strikes not yet folded into a fine — normally 0, 1 or 2. */
  activeStrikeCount?: number;
  /** Fines still awaiting payment/confirmation (status 'pending' or 'submitted'). */
  pendingFineCount?: number;
  /** Amount of a single fine, for the ₹ label (all fines share the same current amount). */
  fineAmount?: number;
}

function StrikeFineBadge({
  activeStrikeCount = 0,
  pendingFineCount = 0,
  fineAmount = 149,
}: {
  activeStrikeCount?: number;
  pendingFineCount?: number;
  fineAmount?: number;
}) {
  if (activeStrikeCount === 0 && pendingFineCount === 0) return null;


  return (
    <div className={`flex flex-col items-end gap-0.5 rounded-2xl px-3 py-1.5 text-right bg-destructive/10 border border-destructive/30`}>
      <span className="flex items-center gap-1 text-[13px] font-semibold text-destructive">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {pendingFineCount > 0 ? `₹${fineAmount * pendingFineCount} fine pending` : `${activeStrikeCount} strike${activeStrikeCount > 1 ? "s" : ""}`}
      </span>
      <span className="text-[11px] text-destructive/70">
        {pendingFineCount} fine{pendingFineCount !== 1 ? "s" : ""} and {activeStrikeCount} active strike{activeStrikeCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
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

export function AttendanceCard({
  isCheckedIn,
  lastCheckinAt,
  shiftStart,
  shiftEnd,
  checkedOutToday,
  offDayReason = null,
  reportPending = false,
  activeStrikeCount = 0,
  pendingFineCount = 0,
  fineAmount = 149,
}: AttendanceCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockedTasks, setBlockedTasks] = useState<BlockedTask[]>([]);
  const [elapsed, setElapsed] = useState<string>("0h 00m 00s");

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportFields, setReportFields] = useState({
    what_i_did_today: "",
    completed_work: "",
    pending_work: "",
    blockers: "",
  });

  // Show the report modal again after a refresh if the server says
  // checkout has been initiated but the report hasn't been submitted yet.
  // This fixes the earlier bug where refreshing made the modal state
  // (which only lived in client memory) disappear.
  useEffect(() => {
    if (reportPending && isCheckedIn) {
      setReportFields({ what_i_did_today: "", completed_work: "", pending_work: "", blockers: "" });
      setReportError(null);
      setShowReportModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportPending, isCheckedIn]);

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

  // Step 1: check tasks, then open the report modal
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
        // Checkout API pass ho gaya — ab report modal dikhao
        setReportFields({ what_i_did_today: "", completed_work: "", pending_work: "", blockers: "" });
        setReportError(null);
        setShowReportModal(true);
      }
    });
  }

  // Step 2: submit the report
  async function handleReportSubmit() {
    const { what_i_did_today, completed_work, pending_work, blockers } = reportFields;
    if (!what_i_did_today.trim() || !completed_work.trim() || !pending_work.trim() || !blockers.trim()) {
      setReportError("Please fill in all fields.");
      return;
    }
    setReportSubmitting(true);
    setReportError(null);
    try {
      const formData = new FormData();
      formData.append("what_i_did_today", what_i_did_today.trim());
      formData.append("completed_work", completed_work.trim());
      formData.append("pending_work", pending_work.trim());
      formData.append("blockers", blockers.trim());

      const res = await fetch("/api/attendance/submit-report", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "checkout_blocked" && data.blockedTasks) {
          // Report form ke khule rehte waqt koi task block ho gaya —
          // modal band karke card par blocked-tasks list dikhao.
          setShowReportModal(false);
          setBlockedTasks(data.blockedTasks);
          return;
        }
        setReportError(data.message ?? data.error ?? "Report submission failed.");
        return;
      }
      setShowReportModal(false);
      router.refresh();
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <>
      <Card className={`border-2 ${isCheckedIn ? "border-emerald-500/40 bg-emerald-950/20" : checkedOutToday ? "border-emerald-500/20" : "border-border"}`}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Attendance</CardTitle>
          <div className="flex flex-col items-end gap-1.5">
            {isCheckedIn && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            )}
            <StrikeFineBadge
              activeStrikeCount={activeStrikeCount}
              pendingFineCount={pendingFineCount}
              fineAmount={fineAmount}
            />
          </div>
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
          ) : offDayReason ? (
            <p className="text-sm text-amber-400 font-medium">
              {offDayReason === "Sunday" ? "Sunday is off today." : `Today is a holiday — ${offDayReason}.`}
            </p>
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

      {/* Daily Report Modal — checkout ke baad mandatory */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-card w-full max-w-lg rounded-xl shadow-2xl">
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Daily Report</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Checkout complete ✓ — please fill in today&apos;s report.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    What I did today
                  </label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    
                    value={reportFields.what_i_did_today}
                    onChange={(e) => setReportFields((p) => ({ ...p, what_i_did_today: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Completed work
                  </label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    
                    value={reportFields.completed_work}
                    onChange={(e) => setReportFields((p) => ({ ...p, completed_work: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Pending work
                  </label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                   
                    value={reportFields.pending_work}
                    onChange={(e) => setReportFields((p) => ({ ...p, pending_work: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Blockers / issues
                  </label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    
                    value={reportFields.blockers}
                    onChange={(e) => setReportFields((p) => ({ ...p, blockers: e.target.value }))}
                  />
                </div>
              </div>

              {reportError && (
                <p className="text-xs text-destructive">{reportError}</p>
              )}

              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={reportSubmitting}
                onClick={handleReportSubmit}
              >
                {reportSubmitting ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}