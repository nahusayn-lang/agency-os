"use client";

import { useState, useTransition } from "react";
import { updateTaskStatusAction, addTaskCommentAction } from "@/lib/tasks/actions";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/lib/types/tasks";
import type { UserRole } from "@/lib/types/database";

interface TaskActionsProps {
  taskId: string;
  status: TaskStatus;
  role: UserRole;
  isAssignee: boolean;
}

export function TaskActions({ taskId, status, role }: TaskActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");

  const canReview = (role === "admin" || role === "super_admin") && status === "waiting_review";
  if (!canReview) return null;

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, "approved");
      if (res?.error) setError(res.error);
    });
  }

  function requestRevision() {
    if (!revisionReason.trim()) {
      setError("Revision reason likhna zaroori hai.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const commentRes = await addTaskCommentAction(taskId, `[Revision Requested] ${revisionReason.trim()}`);
      if (commentRes?.error) {
        setError(commentRes.error);
        return;
      }
      const res = await updateTaskStatusAction(taskId, "revision_required");
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {showRevisionInput ? (
        <div className="space-y-2">
          <textarea
            className="w-full text-sm rounded border px-2 py-1 bg-background"
            placeholder="Revision ka reason likho"
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={requestRevision}>
              Confirm Revision
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRevisionInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={approve}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setShowRevisionInput(true)}>
            Request Revision
          </Button>
        </div>
      )}
    </div>
  );
}