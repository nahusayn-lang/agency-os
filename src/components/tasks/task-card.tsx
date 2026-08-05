"use client";
import { formatDateTime } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProofUpload } from "@/components/tasks/proof-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    priority: string;
    estimated_hours?: number | null;
    deadline?: string | null;
    assigned_by: string;
    assigned_to: string;
    status: string;
    proof_url?: string | null;
    created_at: string;
    total_time_spent_seconds?: number | null;
    session_start_time?: string | null;
  };
  assignerName?: string;
  assignerRole?: string;
}

type ViewState = "idle" | "running" | "pausing" | "submitting";

const PRIORITY_STYLES: Record<string, string> = {
  high:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_STYLES: Record<string, string> = {
  pending:          "border-l-blue-500",
  in_progress:      "border-l-amber-500",
  paused:           "border-l-orange-500",
  revision_required:"border-l-red-500",
  waiting_review:   "border-l-purple-500",
  approved:         "border-l-emerald-500",
  completed:        "border-l-emerald-500",
};

const STATUS_CHIP: Record<string, string> = {
  pending:          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  paused:           "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  revision_required:"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  waiting_review:   "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  approved:         "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending:          "Pending",
  in_progress:      "In Progress",
  paused:           "Paused",
  revision_required:"Needs Revision",
  waiting_review:   "In Review",
  approved:         "Approved",
  completed:        "Completed",
};

export function TaskCard({ task, assignerName, assignerRole }: TaskCardProps) {
  const sessionAlreadyElapsed = task.session_start_time
    ? Math.floor((Date.now() - new Date(task.session_start_time).getTime()) / 1000)
    : 0;

  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<ViewState>(
    task.session_start_time ? "running" : "idle"
  );
  const [elapsed, setElapsed] = useState<number>(sessionAlreadyElapsed);
  const [accumulated, setAccumulated] = useState<number>(
    task.total_time_spent_seconds ?? 0
  );
  const timerRef = useRef<number | null>(null);

  const [pauseNote, setPauseNote] = useState("");
  const [pauseError, setPauseError] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [optionalLink, setOptionalLink] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(task.proof_url ?? null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);

  useEffect(() => {
    if (task.session_start_time) {
      window.localStorage.setItem("running_task", task.id);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [task.id, task.session_start_time]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "running_task" && e.newValue !== task.id && view === "running") {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setAccumulated((prev) => prev + elapsed);
        setElapsed(0);
        setView("idle");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [view, task.id, elapsed]);

  function startTimer() {
  if (isStarting) return;
  const existing = window.localStorage.getItem("running_task");
  if (existing && existing !== task.id) {
    alert("Pause or submit the current task before starting another.");
    return;
  }
  setIsStarting(true);
  fetch("/api/tasks/perform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", taskId: task.id }),
  }).then(() => {
    setIsStarting(false);
    setView("running");
    window.localStorage.setItem("running_task", task.id);
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  });
}

  function stopTimerLocally() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    window.localStorage.removeItem("running_task");
  }

  async function handleConfirmPause() {
  if (isPausing) return;
  if (!pauseNote.trim()) { setPauseError("Please enter a reason for pausing."); return; }
  setPauseError("");
  setIsPausing(true);
  stopTimerLocally();
  const res = await fetch("/api/tasks/perform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pause", taskId: task.id, note: pauseNote }),
  });
  const data = await res.json();
  setIsPausing(false);
  if (data?.error) { alert(data.error); }
  else { setPauseNote(""); setElapsed(0); window.location.reload(); }
}
  async function handleConfirmSubmit() {
    if (!proofUrl) { setSubmitError("Please upload a screenshot."); return; }
    if (!submitNote.trim()) { setSubmitError("Please enter a completion note."); return; }
    setSubmitError("");
    setIsSubmitting(true);
    const res = await fetch("/api/tasks/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", taskId: task.id, note: submitNote, optionalLink }),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (data?.error) { setSubmitError(data.error); }
    else { stopTimerLocally(); window.location.reload(); }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;
  const totalDisplay = accumulated + elapsed;
  const isDone = task.status === "approved" || task.status === "completed";
  const showStartResume = task.status === "pending" || task.status === "revision_required" || task.status === "in_progress" || task.status === "paused";
  const startLabel = task.status === "in_progress" || accumulated > 0 ? "Resume" : "Start";
  const borderColor = STATUS_STYLES[task.status] ?? "border-l-gray-400";

  return (
    <div
      className={`rounded-xl border border-l-4 ${borderColor} bg-card shadow-sm transition-all duration-200`}
    >
      {/* ── COLLAPSED HEADER ── */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left px-4 py-3 flex flex-col gap-2"
      >
        {/* Title — its own row */}
        <span className="break-words font-medium text-sm leading-snug">{task.title}</span>

        {/* Details row — badges, date, chevron */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority badge */}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${PRIORITY_STYLES[task.priority] ?? "bg-muted text-muted-foreground"}`}>
            {task.priority}
          </span>

          {/* Status chip */}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CHIP[task.status] ?? "bg-muted text-muted-foreground"}`}>
            {STATUS_LABEL[task.status] ?? task.status}
          </span>

          {/* Live indicator */}
          {view === "running" && (
            <span className="text-xs text-green-500 animate-pulse shrink-0">● Live</span>
          )}

          {/* Deadline (only if exists) */}
          {task.deadline && (
            <span className="text-xs text-muted-foreground shrink-0" suppressHydrationWarning>
              {formatDateTime(task.deadline)}
            </span>
          )}

          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ml-auto ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── EXPANDED BODY ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">

          {/* Description */}
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {task.estimated_hours && (
              <>
                <span>Estimated Hours</span>
                <span className="text-foreground font-medium">{task.estimated_hours}h</span>
              </>
            )}
            {task.deadline && (
              <>
                <span>Deadline</span>
                <span className="text-foreground font-medium" suppressHydrationWarning>
                  {formatDateTime(task.deadline)}
                </span>
              </>
            )}
            <span>Assigned By</span>
            <span className="text-foreground font-medium">{assignerName ?? "Unknown"} · {assignerRole ?? "—"}</span>

            {(totalDisplay > 0 || isDone) && (
              <>
                <span>Time Spent</span>
                <span className="text-foreground font-medium" suppressHydrationWarning>
                  {formatTime(totalDisplay)}
                  {view === "running" && <span className="ml-1 text-green-500 animate-pulse">● Live</span>}
                </span>
              </>
            )}
          </div>

          {/* Done — no actions */}
          {isDone && (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Task Approved
            </div>
          )}

          {/* Waiting review — no actions */}
          {task.status === "waiting_review" && (
            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">⏳ Submitted — awaiting review</p>
          )}

          {/* Revision notice */}
          {task.status === "revision_required" && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">⚠️ Revision required — resume to continue</p>
          )}

          {/* Paused notice */}
          {task.status === "paused" && (
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">⏸ Paused — resume when you&apos;re ready</p>
          )}

          {/* ── IDLE ACTIONS ── */}
          {view === "idle" && !isDone && task.status !== "waiting_review" && (
            <div className="flex gap-2">
              {showStartResume && (
                <Button size="sm" disabled={isStarting} onClick={startTimer}>{isStarting ? "Starting…" : startLabel}</Button>
              )}
              {task.status === "in_progress" && (
                <Button size="sm" variant="outline" onClick={() => setView("submitting")}>Submit</Button>
              )}
            </div>
          )}

          {/* ── RUNNING ACTIONS ── */}
          {view === "running" && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setView("pausing")}>Pause</Button>
              <Button size="sm" onClick={() => setView("submitting")}>Submit</Button>
            </div>
          )}

          {/* ── PAUSE FORM ── */}
          {view === "pausing" && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">Pause reason</p>
              <Textarea
                id={`pause-note-${task.id}`}
                placeholder="Why are you pausing?"
                value={pauseNote}
                onChange={(e) => setPauseNote(e.target.value)}
                rows={2}
              />
              {pauseError && <p className="text-xs text-red-500">{pauseError}</p>}
              <div className="flex gap-2">
                <Button size="sm" disabled={isPausing} onClick={handleConfirmPause}>{isPausing ? "Pausing…" : "Confirm Pause"}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setPauseNote(""); setPauseError(""); setView("running"); }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ── SUBMIT FORM ── */}
          {view === "submitting" && (
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Submit Task</p>

              <div className="space-y-1">
                <Label>Screenshot (required)</Label>
                <ProofUpload
                  taskId={task.id}
                  currentProofUrl={proofUrl}
                  onUploadComplete={(url) => setProofUrl(url)}
                />
                {!proofUrl && submitError && (
                  <p className="text-xs text-red-500">Please upload a screenshot.</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor={`submit-note-${task.id}`}>Completion note (required)</Label>
                <Textarea
                  id={`submit-note-${task.id}`}
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`submit-link-${task.id}`}>Optional link</Label>
                <Input
                  id={`submit-link-${task.id}`}
                  placeholder="https://..."
                  value={optionalLink}
                  onChange={(e) => setOptionalLink(e.target.value)}
                />
              </div>

              {submitError && <p className="text-xs text-red-500">{submitError}</p>}

              <div className="flex gap-2">
                <Button size="sm" disabled={isSubmitting} onClick={handleConfirmSubmit}>
                  {isSubmitting ? "Submitting…" : "Confirm Submit"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSubmitNote(""); setSubmitError(""); setView("idle"); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskCard;