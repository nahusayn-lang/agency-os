import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/labels";
import type { TaskPriority, TaskStatus } from "@/lib/types/tasks";

export default async function TasksPage() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id, title, priority, status, deadline, assigned_to, assigned_by, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-destructive">Failed to load tasks: {error.message}</p>
    );
  }

  const userIds = new Set<string>();
  for (const task of tasks ?? []) {
    userIds.add(task.assigned_to);
    userIds.add(task.assigned_by);
  }

  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("id", Array.from(userIds));

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {canManageTasks(profile.role)
              ? "All team tasks"
              : "Your assigned tasks"}
          </p>
        </div>
      </div>

      {canManageTasks(profile.role) ? (
        <div>
          <CreateTaskForm />
        </div>
      ) : (
        <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tasks ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No tasks yet.
                </TableCell>
              </TableRow>
            ) : (
              (tasks ?? []).map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="font-medium hover:underline"
                    >
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {userMap.get(task.assigned_to) ?? "Unknown"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {TASK_STATUS_LABELS[task.status as TaskStatus]}
                  </TableCell>
                  <TableCell>
                    {task.deadline
                      ? new Date(task.deadline).toLocaleDateString()
                      : "—"}
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
