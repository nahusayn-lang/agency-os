"use client";

import { useState, useTransition } from "react";
import { overridePerformanceScoreAction } from "@/lib/performance/actions";
import type { PerformanceScore } from "@/lib/types/performance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PerformanceScoreOverrideModalProps {
  targetUserId: string;
  periodStart: string;
  periodEnd: string;
  current: PerformanceScore;
}

export function PerformanceScoreOverrideModal({
  targetUserId,
  periodStart,
  periodEnd,
  current,
}: PerformanceScoreOverrideModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [taskScore, setTaskScore] = useState(String(current.task_score));
  const [attendanceScore, setAttendanceScore] = useState(
    String(current.attendance_score)
  );
  const [leadScore, setLeadScore] = useState(String(current.lead_score));
  const [reasonNote, setReasonNote] = useState("");

  function handleSubmit() {
    setError(null);
    const trimmedReason = reasonNote.trim();
    if (!trimmedReason) {
      setError("Override reason is required.");
      return;
    }
    if (trimmedReason.length < 10) {
      setError("Override reason must be at least 10 characters.");
      return;
    }
    startTransition(async () => {
      const result = await overridePerformanceScoreAction({
        targetUserId,
        periodStart,
        periodEnd,
        task_score: Number(taskScore),
        attendance_score: Number(attendanceScore),
        lead_score: Number(leadScore),
        report_score: 0,
        reasonNote,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setReasonNote("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setError(null);
      }
    }}>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Override score (god mode)
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override performance score</DialogTitle>
          <DialogDescription>
            This creates a god mode audit record. Calculated scores in the
            database are never changed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="override-task">Task score</Label>
            <Input
              id="override-task"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={taskScore}
              onChange={(e) => setTaskScore(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="override-attendance">Attendance score</Label>
            <Input
              id="override-attendance"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={attendanceScore}
              onChange={(e) => setAttendanceScore(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="override-lead">Lead score</Label>
            <Input
              id="override-lead"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={leadScore}
              onChange={(e) => setLeadScore(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Report score is fixed at 0 for Phase A.
          </p>
          <div className="space-y-2">
            <Label htmlFor="override-reason">Reason (required)</Label>
            <Textarea
              id="override-reason"
              value={reasonNote}
              onChange={(e) => {
                setReasonNote(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Provide a reason for overriding this score (minimum 10 characters)..."
              rows={3}
              required
            />
            <div className="flex justify-between items-center text-xs">
              <span className={reasonNote.trim().length < 10 ? "text-destructive" : "text-muted-foreground"}>
                {reasonNote.trim().length < 10
                  ? `Min 10 characters required (${reasonNote.trim().length}/10)`
                  : `Requirement met (${reasonNote.trim().length} characters)`}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !reasonNote.trim()}
            onClick={handleSubmit}
          >
            {pending ? "Saving…" : "Record override"}
          </Button>
        </DialogFooter>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
