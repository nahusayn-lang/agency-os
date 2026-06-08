"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProofUpload } from "@/components/tasks/proof-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  };
  assignerName?: string;
  assignerRole?: string;
}

export function TaskCard({ task, assignerName, assignerRole }: TaskCardProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  const [pauseNote, setPauseNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitNote, setSubmitNote] = useState("");
  const [optionalLink, setOptionalLink] = useState("");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "running_task" && e.newValue !== task.id) {
        // another task started elsewhere, stop this one
        if (running) stopTimer();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [running, task.id]);

  function startTimer() {
    // inform server to set in_progress
    fetch("/api/tasks/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", taskId: task.id }),
    }).then(() => {
      setRunning(true);
      window.localStorage.setItem("running_task", task.id);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    });
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
    window.localStorage.removeItem("running_task");
  }

  async function handlePause() {
    if (!pauseNote.trim()) {
      alert("Pause note is required.");
      return;
    }
    stopTimer();
    const chunk = elapsed;
    setElapsed(0);
    const res = await fetch("/api/tasks/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause", taskId: task.id, note: pauseNote, totalTimeSeconds: chunk }),
    });
    const data = await res.json();
    if (data?.error) alert(data.error);
    setPauseNote("");
  }

  async function handleSubmit() {
    if (!submitNote.trim()) {
      alert("Completion note is required.");
      return;
    }
    setSubmitting(true);
    // total time includes current elapsed + any previous total (not persisted here)
    const totalTime = elapsed;
    const res = await fetch("/api/tasks/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", taskId: task.id, note: submitNote, optionalLink, totalTimeSeconds: totalTime }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data?.error) {
      alert(data.error);
    } else {
      stopTimer();
      setSubmitNote("");
      setOptionalLink("");
      // reload
      window.location.reload();
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <h3 className="font-medium">{task.title}</h3>
      {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
      <div className="mt-2 text-sm">
        <div>Priority: {task.priority}</div>
        <div>Estimated Hours: {task.estimated_hours ?? "—"}</div>
        <div>Deadline: {task.deadline ? new Date(task.deadline).toLocaleString() : "—"}</div>
        <div>Assigned By: {assignerName ?? "Unknown"} ({assignerRole ?? "—"})</div>
        <div>Status: {task.status}</div>
        <div>Total time (this session): {Math.floor(elapsed / 60)}m {elapsed % 60}s</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!running && <Button onClick={startTimer}>Start</Button>}
        {running && <Button onClick={stopTimer}>Pause Timer</Button>}
        <Button variant="outline" onClick={() => document.getElementById(`pause-note-${task.id}`)?.scrollIntoView()}>Pause</Button>
        <Button onClick={() => document.getElementById(`submit-form-${task.id}`)?.scrollIntoView()}>Submit</Button>
      </div>

      <div id={`pause-note-${task.id}`} className="mt-4">
        <Label htmlFor={`pause-note-input-${task.id}`}>Pause note (required)</Label>
        <Input id={`pause-note-input-${task.id}`} value={pauseNote} onChange={(e) => setPauseNote(e.target.value)} />
        <div className="mt-2">
          <Button onClick={handlePause}>Confirm Pause</Button>
        </div>
      </div>

      <div id={`submit-form-${task.id}`} className="mt-4">
        <h4 className="font-medium">Submit Task</h4>
        <div className="mt-2">
          <Label>Proof (screenshot)</Label>
          <ProofUpload taskId={task.id} currentProofUrl={task.proof_url ?? null} />
        </div>
        <div className="mt-2">
          <Label htmlFor={`submit-note-${task.id}`}>Completion note (required)</Label>
          <Input id={`submit-note-${task.id}`} value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} />
        </div>
        <div className="mt-2">
          <Label htmlFor={`submit-link-${task.id}`}>Optional link</Label>
          <Input id={`submit-link-${task.id}`} value={optionalLink} onChange={(e) => setOptionalLink(e.target.value)} />
        </div>
        <div className="mt-2">
          <Button disabled={submitting} onClick={handleSubmit}>{submitting ? "Submitting…" : "Submit"}</Button>
        </div>
      </div>
    </div>
  );
}

export default TaskCard;
