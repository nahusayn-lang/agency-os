"use client";

import { useState, useTransition } from "react";
import { updateTaskStatusAction } from "@/lib/tasks/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { TaskStatus } from "@/lib/types/tasks";
import type { UserRole } from "@/lib/types/database";
import { getAllowedTransitions } from "@/lib/tasks/transitions";

interface TaskActionsProps {
  taskId: string;
  status: TaskStatus;
  role: UserRole;
  isAssignee: boolean;
}

export function TaskActions({
  taskId,
  status,
  role,
  isAssignee,
}: TaskActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function transition(to: TaskStatus, options?: { forceClose?: boolean; rejectionReason?: string }) {
    setError(null);
    startTransition(async () => {
      const result = await updateTaskStatusAction(taskId, to, {
        forceClose: options?.forceClose,
        overrideReason: options?.forceClose ? overrideReason : undefined,
        rejectionReason: options?.rejectionReason,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setOverrideOpen(false);
        setOverrideReason("");
        setRejectOpen(false);
        setRejectReason("");
      }
    });
  }

  const memberActions =
    role === "member" && isAssignee ? (
      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <Button disabled={pending} onClick={() => transition("in_progress")}>
            Start work
          </Button>
        )}
        {status === "in_progress" && (
          <Button
            disabled={pending}
            onClick={() => transition("waiting_review")}
          >
            Submit for review
          </Button>
        )}
        {status === "revision_required" && (
          <Button disabled={pending} onClick={() => transition("in_progress")}>
            Resume work
          </Button>
        )}
      </div>
    ) : null;

  const adminActions =
    role === "admin" || role === "super_admin" ? (
      <div className="flex flex-wrap gap-2">
        {status === "waiting_review" && (
          <>
            <Button
              disabled={pending}
              onClick={() => transition("approved")}
            >
              Approve
            </Button>
            {role === "super_admin" ? (
              <>
                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reject submission</DialogTitle>
                      <DialogDescription>
                        Provide a reason for the rejection. This will add a
                        strike and return the task to the assignee.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="reject-reason">Reason</Label>
                      <Textarea
                        id="reject-reason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        disabled={pending || !rejectReason.trim()}
                        onClick={() => transition("revision_required", { rejectionReason: rejectReason })}
                      >
                        Confirm reject
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => transition("revision_required")}
              >
                Request revision
              </Button>
            )}
          </>
        )}
        {status === "approved" && (
          <Button disabled={pending} onClick={() => transition("completed")}>
            Mark completed
          </Button>
        )}
        {getAllowedTransitions(role, status)
          .filter(
            (s) =>
              !["revision_required", "approved", "completed"].includes(s) ||
              status === "revision_required"
          )
          .length === 0 &&
          status !== "waiting_review" &&
          status !== "approved" &&
          role === "admin" && null}
      </div>
    ) : null;

  const forceClose =
    role === "super_admin" && status !== "completed" ? (
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => setOverrideOpen(true)}
        >
          Force close
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force close task</DialogTitle>
            <DialogDescription>
              This override will be recorded in god mode audit. A reason is
              required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="override-reason">Reason</Label>
            <Textarea
              id="override-reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={4}
              required
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={pending || !overrideReason.trim()}
              onClick={() => transition("completed", { forceClose: true })}
            >
              Confirm force close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ) : null;

  return (
    <div className="space-y-2">
      {memberActions}
      {adminActions}
      {forceClose}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
