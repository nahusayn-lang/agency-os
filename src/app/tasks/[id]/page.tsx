import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TaskActions } from "@/components/tasks/task-actions";
import { TaskComments } from "@/components/tasks/task-comments";
import { ProofUpload } from "@/components/tasks/proof-upload";
import { Badge } from "@/components/ui/badge";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/labels";
import type { TaskPriority, TaskStatus } from "@/lib/types/tasks";

interface TaskDetailPageProps {
  params: { id: string };
}

/** Strip "Time chunk (s): X" suffix from completion notes / comments */
function stripTimeChunk(text: string): string {
  return text
    .replace(/\s*Time chunk \(s\):\s*\d+/gi, "")
    .trim();
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !task) {
    notFound();
  }

  const { data: activity } = await supabase
    .from("task_activity")
    .select("id, action, old_status, new_status, created_at, performed_by")
    .eq("task_id", params.id)
    .order("created_at", { ascending: false });

  const { data: comments } = await supabase
    .from("task_comments")
    .select("id, message, created_at, user_id")
    .eq("task_id", params.id)
    .order("created_at", { ascending: true });

  const userIds = new Set<string>([
    task.assigned_to,
    task.assigned_by,
    ...(activity ?? []).map((a) => a.performed_by),
    ...(comments ?? []).map((c) => c.user_id),
  ]);

  // Admin client bypasses RLS so user names resolve correctly
  const adminClient = createAdminClient();
  const { data: users } = await adminClient
    .from("users")
    .select("id, name")
    .in("id", Array.from(userIds));

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));

  const completionComment = (comments ?? [])
    .slice()
    .reverse()
    .find((comment) => comment.user_id === task.assigned_to);

  const pauseHistory = (activity ?? [])
    .filter((entry) => entry.action === "pause")
    .map((entry) => {
      const comment = (comments ?? []).find(
        (c) =>
          c.user_id === entry.performed_by &&
          Math.abs(new Date(c.created_at).getTime() - new Date(entry.created_at).getTime()) <
            30000
      );
      return {
        ...entry,
        reason: comment?.message ? stripTimeChunk(comment.message.split("\n")[0]) : null,
      };
    });

  const isAssignee = task.assigned_to === profile.id;
  const isReviewer = profile.role === "admin" || profile.role === "super_admin";

  const statusVariantMap: Record<TaskStatus, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    in_progress: "default",
    paused: "destructive",
    waiting_review: "secondary",
    revision_required: "destructive",
    approved: "default",
    completed: "secondary",
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href="/tasks" className="text-sm text-muted-foreground hover:underline">
          ← Back to tasks
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {task.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">
            {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
          </Badge>
          <Badge variant={statusVariantMap[task.status as TaskStatus]}>
            {TASK_STATUS_LABELS[task.status as TaskStatus]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {task.description && (
            <section>
              <h2 className="mb-2 font-medium">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            </section>
          )}

          <section className="rounded-xl border p-4 space-y-4">
            <h2 className="font-medium">Submission Details</h2>
            {task.proof_url ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Proof screenshot</p>
                <a href={task.proof_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={task.proof_url}
                    alt="Task proof screenshot"
                    className="h-64 w-full rounded-xl border object-cover"
                  />
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No proof screenshot uploaded.</p>
            )}

            {completionComment ? (
              <div className="rounded-xl border bg-muted p-3">
                <p className="text-sm font-medium">Completion note</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {stripTimeChunk(completionComment.message)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No completion note available.</p>
            )}

            <div>
              <p className="text-sm font-medium">Pause history</p>
              {pauseHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No pause history recorded.</p>
              ) : (
                <ol className="mt-2 space-y-3">
                  {pauseHistory.map((entry) => (
                    <li key={entry.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">
                        {userMap.get(entry.performed_by) ?? "Unknown"}
                      </p>
                      <p className="text-muted-foreground">
                        {entry.reason ?? "No pause reason provided."}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-medium">Activity</h2>
            <ol className="space-y-3">
              {(activity ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">No activity yet.</li>
              ) : (
                (activity ?? []).map((entry) => (
                  <li key={entry.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">
                      {userMap.get(entry.performed_by) ?? "Unknown"} —{" "}
                      {entry.action.replace(/_/g, " ")}
                    </p>
                    {entry.old_status && entry.new_status && (
                      <p className="text-muted-foreground">
                        {TASK_STATUS_LABELS[entry.old_status as TaskStatus] ??
                          entry.old_status}{" "}
                        →{" "}
                        {TASK_STATUS_LABELS[entry.new_status as TaskStatus] ??
                          entry.new_status}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </li>
                ))
              )}
            </ol>
          </section>

          <section>
            <h2 className="mb-3 font-medium">Comments</h2>
            <TaskComments
              taskId={params.id}
              comments={(comments ?? []).map((c) => ({
                id: c.id,
                message: c.message,
                created_at: c.created_at,
                user: { name: userMap.get(c.user_id) ?? "Unknown" },
              }))}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border p-4 space-y-3">
            <h2 className="font-medium">Details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Assignee</dt>
                <dd>{userMap.get(task.assigned_to) ?? "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assigned by</dt>
                <dd>{userMap.get(task.assigned_by) ?? "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Deadline</dt>
                <dd>
                  {task.deadline
                    ? new Date(task.deadline).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{new Date(task.created_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total recorded time</dt>
                <dd>
                  {(() => {
                    const secs = (task.total_time_spent_seconds as number) ?? 0;
                    const h = Math.floor(secs / 3600);
                    const m = Math.floor((secs % 3600) / 60);
                    const s = secs % 60;
                    return `${h}h ${m}m ${s}s`;
                  })()}
                </dd>
              </div>
            </dl>
          </section>

          {task.status === "waiting_review" && isReviewer && (
            <section className="rounded-xl border p-4 space-y-3">
              <h2 className="font-medium">Actions</h2>
              <TaskActions
                taskId={params.id}
                status={task.status as TaskStatus}
                role={profile.role}
                isAssignee={isAssignee}
              />
            </section>
          )}

          {isAssignee && task.status === "in_progress" && (
            <section className="rounded-xl border p-4 space-y-3">
              <h2 className="font-medium">Proof upload</h2>
              <ProofUpload taskId={params.id} currentProofUrl={task.proof_url} />
            </section>
          )}

          {task.proof_url && !(isAssignee && task.status === "in_progress") && (
            <section className="rounded-xl border p-4">
              <h2 className="mb-2 font-medium">Proof</h2>
              <a
                href={task.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View proof
              </a>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}