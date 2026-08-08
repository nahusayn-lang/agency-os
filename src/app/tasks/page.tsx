import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTasks } from "@/lib/tasks/permissions";
import { CreateTaskForm } from "@/components/tasks/create-task-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TASK_STATUS_LABELS } from "@/lib/tasks/labels";
import { formatDate } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types/tasks";

export default async function TasksPage() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const isFounder = profile.role === "super_admin";

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, status, deadline, assigned_to, assigned_by, created_at, is_mandatory")
    .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-destructive">Failed to load tasks: {error.message}</p>;
  }

  const userIds = new Set<string>();
  for (const task of tasks ?? []) {
    userIds.add(task.assigned_to);
    userIds.add(task.assigned_by);
  }

  const adminClient = createAdminClient();
  const { data: users } = userIds.size
    ? await adminClient.from("users").select("id, name").in("id", Array.from(userIds))
    : { data: [] };

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));

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

      {isFounder && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tasks ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No tasks yet.
                  </TableCell>
                </TableRow>
              ) : (
                (tasks ?? []).map((task) => (
                  <TableRow key={task.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <Link href={`/tasks/${task.id}`} className="font-medium hover:underline break-words">
                        {task.title}
                      </Link>
                      {task.is_mandatory && (
                        <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 align-middle">
                          Mandatory
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/tasks/${task.id}`} className="text-muted-foreground hover:text-foreground">
                        {userMap.get(task.assigned_to) ?? "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariantMap[task.status as TaskStatus]}>
                        {TASK_STATUS_LABELS[task.status as TaskStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/tasks/${task.id}`} className="hover:underline">
                        {task.deadline ? formatDate(task.deadline) : "—"}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}