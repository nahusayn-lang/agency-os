"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ProofUpload } from "@/components/tasks/proof-upload";

export interface FlashTask {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress";
  flash_duration_hours: number | null;
  deadline: string | null;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Time's up";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}h ${m}m left` : `${m}m ${s}s left`;
}

export function FlashTaskCard({ task }: { task: FlashTask }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (task.status !== "in_progress") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [task.status]);

  async function handleStart() {
    setIsStarting(true);
    const res = await fetch("/api/tasks/flash-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    setIsStarting(false);
    if (res.ok) router.refresh();
    else {
      const data = await res.json();
      alert(data?.error ?? "Failed to start.");
    }
  }

  async function handleSubmit() {
    if (!proofUrl) {
      setSubmitError("Please upload a screenshot.");
      return;
    }
    if (!note.trim()) {
      setSubmitError("Please enter a completion note.");
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);

    // Same endpoint + same "submit" action as a normal task — this
    // sends it to waiting_review, exactly like the regular task flow.
    const res = await fetch("/api/tasks/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", taskId: task.id, note, optionalLink: proofUrl }),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (data?.error) setSubmitError(data.error);
    else router.refresh();
  }

  const remainingMs = task.deadline ? new Date(task.deadline).getTime() - now : null;
  const overdue = remainingMs != null && remainingMs <= 0;

  return (
    <Card className={overdue ? "border-destructive/50" : "border-primary/40"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">⚡ Flash Task</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium">{task.title}</p>
        {task.description && (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        )}

        {task.status === "pending" && (
          <>
            <p className="text-sm text-muted-foreground">
              Duration: {task.flash_duration_hours}h — starts counting the moment you press Start.
            </p>
            <Button disabled={isStarting} onClick={handleStart}>
              {isStarting ? "Starting…" : "Start"}
            </Button>
          </>
        )}

        {task.status === "in_progress" && remainingMs != null && (
          <>
            <p
              className={
                "text-lg font-semibold " + (overdue ? "text-destructive" : "text-primary")
              }
            >
              {formatRemaining(remainingMs)}
            </p>

            {!showSubmitForm ? (
              <Button onClick={() => setShowSubmitForm(true)}>Submit</Button>
            ) : (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="space-y-1">
                  <Label>Screenshot (required)</Label>
                  <ProofUpload
                    taskId={task.id}
                    currentProofUrl={proofUrl}
                    onUploadComplete={(url) => setProofUrl(url)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`flash-note-${task.id}`}>Completion note (required)</Label>
                  <textarea
                    id={`flash-note-${task.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border px-2 py-1.5 text-sm bg-background resize-none"
                    placeholder="What did you complete?"
                  />
                </div>
                {submitError && <p className="text-xs text-destructive">{submitError}</p>}
                <div className="flex gap-2">
                  <Button disabled={isSubmitting} onClick={handleSubmit}>
                    {isSubmitting ? "Submitting…" : "Submit for review"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowSubmitForm(false)}
                    className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}