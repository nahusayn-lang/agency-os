"use client";

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
  };
  assignerName?: string;
  assignerRole?: string;
}

type ViewState = "idle" | "running" | "pausing" | "submitting";

export function TaskCard({ task, assignerName, assignerRole }: TaskCardProps) {
  const [view, setView] = useState<ViewState>("idle");
  // elapsed = time in THIS session only (since last start/resume)
  const [elapsed, setElapsed] = useState<number>(0);
  // accumulated = total time across all sessions (from DB + current session)
  const [accumulated, setAccumulated] = useState<number>(
    task.total_time_spent_seconds ?? 0
  );
  const timerRef = useRef<number | null>(null);

  // Pause form
  const [pauseNote, setPauseNote] = useState("");
  const [pauseError, setPauseError] = useState("");

  // Submit form
  const [submitNote, setSubmitNote] = useState("");
  const [optionalLink, setOptionalLink] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(task.proof_url ?? null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Listen for another task starting — stop this one silently
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "running_task" && e.newValue !== task.id && view === "running") {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        // save current elapsed into accumulated
        setAccumulated((prev) => prev + elapsed);
        setElapsed(0);
        setView("idle");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [view, task.id, elapsed]);

  function startTimer() {
    const existing = window.localStorage.getItem("running_task");
    if (existing && existing !== task.id) {
      alert("Pehle chalta hua task pause ya submit karo, tab hi doosra start hoga.");
      return;
    }

    fetch("/api/tasks/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", taskId: task.id }),
    }).then(() => {
      setView("running");
      window.localStorage.setItem("running_task", task.id);
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
    });
  }

  function stopTimerLocally() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    window.localStorage.removeItem("running_task");
    window.localStorage.removeItem("running_task_elapsed");
  }

  async function handleConfirmPause() {
    if (!pauseNote.trim()) {
      setPauseError("Pause karne ki wajah likhna zaroori hai.");
      return;
    }
    setPauseError("");

    // Stop timer first
    stopTimerLocally();

    // Save this session's time to accumulated
    const sessionTime = elapsed;
    setAccumulated((prev) => prev + sessionTime);
    setElapsed(0); // reset session timer

    const res = await fetch("/api/tasks/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pause",
        taskId: task.id,
        note: pauseNote,
        totalTimeSeconds: sessionTime, // only send this session's time; backend adds to DB total
      }),
    });
    const data = await res.json();
    if (data?.error) {
      alert(data.error);
    } else {
      setPauseNote("");
      setView("idle"); // go back to idle — timer stays at 0, accumulated shows total
    }
  }

  async function handleConfirmSubmit() {
    if (!proofUrl) {
      setSubmitError("Screenshot upload karna zaroori hai.");
      return;
    }
    if (!submitNote.trim()) {
      setSubmitError("Completion note likhna zaroori hai.");
      return;
    }
    setSubmitError("");
    setIsSubmitting(true);

    const totalTime = accumulated + elapsed; // all time ever spent

    const res = await fetch("/api/tasks/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        taskId: task.id,
        note: submitNote,
        optionalLink,
        totalTimeSeconds: totalTime,
      }),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (data?.error) {
      setSubmitError(data.error);
    } else {
      stopTimerLocally();
      window.location.reload();
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;
  const totalDisplay = accumulated + elapsed;

  return (
    <div className="rounded-xl border p-4 space-y-3">
      {/* Task Info */}
      <div>
        <h3 className="font-semibold text-base">{task.title}</h3>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>
        )}
      </div>

      <div className="text-sm space-y-0.5 text-muted-foreground">
        <div>Priority: <span className="text-foreground">{task.priority}</span></div>
        <div>Estimated Hours: <span className="text-foreground">{task.estimated_hours ?? "—"}</span></div>
        <div>Deadline: <span className="text-foreground">{task.deadline ? new Date(task.deadline).toLocaleString() : "—"}</span></div>
        <div>Assigned By: <span className="text-foreground">{assignerName ?? "Unknown"} ({assignerRole ?? "—"})</span></div>
        <div>Status: <span className="text-foreground">{task.status}</span></div>
        <div>
          Total time spent:{" "}
          <span className="text-foreground font-medium">{formatTime(totalDisplay)}</span>
          {view === "running" && (
            <span className="ml-2 text-xs text-green-500 animate-pulse">● Live</span>
          )}
        </div>
      </div>

      {/* === IDLE STATE === */}
      {view === "idle" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={startTimer}>
            {accumulated > 0 ? "Resume" : "Start"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("submitting")}>
            Submit
          </Button>
        </div>
      )}

      {/* === RUNNING STATE === */}
      {view === "running" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setView("pausing")}>
            Pause
          </Button>
          <Button size="sm" onClick={() => setView("submitting")}>
            Submit
          </Button>
        </div>
      )}

      {/* === PAUSE FORM === */}
      {view === "pausing" && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <p className="text-sm font-medium">Task Pause — Wajah batao</p>
          <div className="space-y-1">
            <Label htmlFor={`pause-note-${task.id}`}>Pause reason (required)</Label>
            <Textarea
              id={`pause-note-${task.id}`}
              placeholder="Kyu pause kar rahe ho?"
              value={pauseNote}
              onChange={(e) => setPauseNote(e.target.value)}
              rows={2}
            />
            {pauseError && <p className="text-xs text-red-500">{pauseError}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleConfirmPause}>
              Confirm Pause
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPauseNote("");
                setPauseError("");
                setView("running");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* === SUBMIT FORM === */}
      {view === "submitting" && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">Task Submit</p>

          <div className="space-y-1">
            <Label>Screenshot (required)</Label>
            <ProofUpload
              taskId={task.id}
              currentProofUrl={proofUrl}
              onUploadComplete={(url) => setProofUrl(url)}
            />
            {!proofUrl && submitError && (
              <p className="text-xs text-red-500">Screenshot upload karna zaroori hai.</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor={`submit-note-${task.id}`}>Completion note (required)</Label>
            <Textarea
              id={`submit-note-${task.id}`}
              placeholder="Kya kiya? Kaise complete hua?"
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSubmitNote("");
                setSubmitError("");
                setView("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskCard;