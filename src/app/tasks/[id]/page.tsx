import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TaskActions } from "@/components/tasks/task-actions";
import { TaskComments } from "@/components/tasks/task-comments";
import { ProofUpload } from "@/components/tasks/proof-upload";
import { Badge } from "@/components/ui/badge";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/tasks/labels";
import type { TaskPriority, TaskStatus } from "@/lib/types/tasks";

interface TaskDetailPageProps {
  params: { id: string };
}

function stripTimeChunk(text: string): string {
  return text.replace(/\s*Time chunk \(s\):\s*\d+/gi, "").trim();
}

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${m}m ${s}s`;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !task) notFound();

  const { data: comments } = await supabase
    .from("task_comments")
    .select("id, message, created_at, user_id")
    .eq("task_id", params.id)
    .order("created_at", { ascending: true });

  const userIds = new Set<string>([
    task.assigned_to,
    task.assigned_by,
    ...(comments ?? []).map((c) => c.user_id),
  ]);

  const adminClient = createAdminClient();

  const { data: users } = await adminClient
    .from("users")
    .select("id, name")
    .in("id", Array.from(userIds));

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));

  const completionComment = (comments ?? [])
    .slice()
    .reverse()
    .find((c) => c.user_id === task.assigned_to);

  const isAssignee = task.assigned_to === profile.id;
  const isReviewer =
    profile.role === "admin" || profile.role === "super_admin";

  const statusVariantMap: Record<
    TaskStatus,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    pending: "secondary",
    in_progress: "default",
    paused: "destructive",
    waiting_review: "secondary",
    revision_required: "destructive",
    approved: "default",
    completed: "secondary",
  };

  return (
    <div className="space-y-6 px-4 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/tasks"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to tasks
        </Link>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {task.title}
        </h1>

        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">
            {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
          </Badge>

          <Badge
            variant={statusVariantMap[task.status as TaskStatus]}
          >
            {TASK_STATUS_LABELS[task.status as TaskStatus]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          {task.description && (
            <section className="rounded-xl border p-4">
              <h2 className="mb-2 font-medium">Description</h2>

              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            </section>
          )}

          {/* Completion Note */}
          <section className="rounded-xl border p-4">
            <h2 className="mb-2 font-medium">Completion Note</h2>

            {completionComment ? (
              <p className="text-sm whitespace-pre-wrap">
                {stripTimeChunk(completionComment.message)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No completion note yet.
              </p>
            )}
          </section>

          {/* Comments */}
          <section className="rounded-xl border p-4">
            <h2 className="mb-3 font-medium">Comments</h2>

            <TaskComments
              taskId={params.id}
              comments={(comments ?? []).map((c) => ({
                id: c.id,
                message: c.message,
                created_at: c.created_at,
                user: {
                  name: userMap.get(c.user_id) ?? "Unknown",
                },
              }))}
            />
          </section>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          {/* Details */}
          <section className="rounded-xl border p-4 space-y-3">
            <h2 className="font-medium">Details</h2>

            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Assignee</dt>
                <dd>{userMap.get(task.assigned_to) ?? "Unknown"}</dd>
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
                <dt className="text-muted-foreground">Time Spent</dt>
                <dd>
                  {formatTime(
                    (task.total_time_spent_seconds as number) ?? 0
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Approve / Reject */}
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

          {/* Proof Upload (assignee only) */}
          {isAssignee && task.status === "in_progress" && (
            <section className="rounded-xl border p-4 space-y-3">
              <h2 className="font-medium">Upload Proof</h2>

              <ProofUpload
                taskId={params.id}
                currentProofUrl={task.proof_url}
              />
            </section>
          )}

          {/* View Proof link */}
          {task.proof_url &&
            !(isAssignee && task.status === "in_progress") && (
              <section className="rounded-xl border p-4">
                <h2 className="mb-2 font-medium">Proof</h2>

                <a
                  href={task.proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View proof ↗
                </a>
              </section>
            )}
        </div>
      </div>
    </div>
  );
}