import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTasks } from "@/lib/tasks/permissions";
import { CreateTaskForm } from "@/components/tasks/create-task-form";
import { PendingApprovalSection, type PendingApprovalTask } from "@/components/tasks/pending-approval-section";

export default async function TasksPage() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const isFounder = profile.role === "super_admin";
  const adminClient = createAdminClient();

  let pendingApprovalTasks: PendingApprovalTask[] = [];
  if (canManageTasks(profile.role)) {
    const reviewQuery = isFounder
      ? supabase
          .from("tasks")
          .select("id, title, description, assigned_to, assigned_by, updated_at, proof_url, deadline, status, total_time_spent_seconds")
      : supabase
          .from("tasks")
          .select("id, title, description, assigned_to, assigned_by, updated_at, proof_url, deadline, status, total_time_spent_seconds")
          .eq("assigned_by", profile.id);

    const { data: reviewTasks } = await reviewQuery.order("updated_at", { ascending: false });

    const reviewIds = (reviewTasks ?? []).map((t) => t.id);
    const reviewUserIds = new Set<string>();
    (reviewTasks ?? []).forEach((t) => reviewUserIds.add(t.assigned_to));

    const { data: reviewUsers } = reviewUserIds.size
      ? await adminClient.from("users").select("id, name").in("id", Array.from(reviewUserIds))
      : { data: [] };
    const reviewUserMap = new Map((reviewUsers ?? []).map((u) => [u.id, u.name]));

    const { data: comments } = reviewIds.length
      ? await supabase
          .from("task_comments")
          .select("task_id, message, created_at")
          .in("task_id", reviewIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const latestNoteByTask = new Map<string, string>();
    (comments ?? []).forEach((c) => {
      if (!latestNoteByTask.has(c.task_id)) latestNoteByTask.set(c.task_id, c.message);
    });

    pendingApprovalTasks = (reviewTasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      assignedToId: t.assigned_to,
      assignedToName: reviewUserMap.get(t.assigned_to) ?? "Unknown",
      updatedAt: t.updated_at,
      deadline: t.deadline,
      timeSpentSeconds: t.total_time_spent_seconds,
      proofUrl: t.proof_url,
      note: latestNoteByTask.get(t.id) ?? null,
      isMine: t.assigned_by === profile.id,
    }));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Tasks assigned by or to you.
          </p>
        </div>
      </div>

      {canManageTasks(profile.role) && (
        <div>
          <CreateTaskForm />
        </div>
      )}

      {canManageTasks(profile.role) && pendingApprovalTasks.length > 0 && (
        <PendingApprovalSection
          tasks={pendingApprovalTasks}
          isFounder={isFounder}
          currentUserId={profile.id}
        />
      )}
    </div>
  );
}