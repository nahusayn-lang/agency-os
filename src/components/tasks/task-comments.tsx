"use client";

import { useState, useTransition } from "react";
import { addTaskCommentAction } from "@/lib/tasks/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface TaskCommentsProps {
  taskId: string;
  comments: Array<{
    id: string;
    message: string;
    created_at: string;
    user: { name: string };
  }>;
}

export function TaskComments({ taskId, comments }: TaskCommentsProps) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addTaskCommentAction(taskId, message);
      if (result?.error) {
        setError(result.error);
      } else {
        setMessage("");
      }
    });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        ) : (
          comments.map((comment) => (
            <li key={comment.id} className="rounded-lg border p-3">
              <p className="text-sm">{comment.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {comment.user.name} ·{" "}
                {new Date(comment.created_at).toLocaleString()}
              </p>
            </li>
          ))
        )}
      </ul>
      <div className="space-y-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
        />
        <Button onClick={submit} disabled={pending || !message.trim()}>
          Post comment
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
