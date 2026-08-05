import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import TaskCard from "@/components/tasks/task-card";
import { Card } from "@/components/ui/card";

type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  estimated_hours?: number | null;
  deadline?: string | null;
  assigned_by: string;
  assigned_to: string;
  status: string;
  proof_url?: string | null;
  created_at: string;
  total_time_spent_seconds?: number | null;
  session_start_time?: string | null;
};

export default async function MyTasksPage() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, priority, estimated_hours, deadline, assigned_by, assigned_to, status, proof_url, created_at, total_time_spent_seconds, session_start_time")
    .eq("assigned_to", profile.id)
    .order("created_at", { ascending: false });

  const rows = (tasks ?? []) as TaskRow[];
  const userIds = new Set<string>([profile.id as string]);
  for (const t of rows) userIds.add(t.assigned_by);

  type UserInfo = { id: string; name: string; role: string };
  const { data: users } = await supabase.from("users").select("id, name, role").in("id", Array.from(userIds));
  const userMap = new Map((users ?? []).map((u: UserInfo) => [u.id, u]));

  const activeTasks = rows.filter(
    (task) =>
      task.status === "in_progress" ||
      task.status === "revision_required" ||
      task.status === "paused"
  );
  const pendingTasks = rows.filter((task) => task.status === "pending");
  const reviewTasks = rows.filter((task) => task.status === "waiting_review");
  const doneTasks = rows.filter((task) =>
    task.status === "approved" || task.status === "completed"
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-muted-foreground">Tasks assigned to you for execution and submission.</p>
      </div>

      {activeTasks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Active</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeTasks.map((t) => (
              <Card key={t.id}>
                <TaskCard
                  task={t}
                  assignerName={userMap.get(t.assigned_by)?.name}
                  assignerRole={userMap.get(t.assigned_by)?.role}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      {pendingTasks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Pending</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pendingTasks.map((t) => (
              <Card key={t.id}>
                <TaskCard
                  task={t}
                  assignerName={userMap.get(t.assigned_by)?.name}
                  assignerRole={userMap.get(t.assigned_by)?.role}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      {reviewTasks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">In Review</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {reviewTasks.map((t) => (
              <Card key={t.id}>
                <TaskCard
                  task={t}
                  assignerName={userMap.get(t.assigned_by)?.name}
                  assignerRole={userMap.get(t.assigned_by)?.role}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      {doneTasks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Done</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {doneTasks.map((t) => (
              <Card key={t.id}>
                <TaskCard
                  task={t}
                  assignerName={userMap.get(t.assigned_by)?.name}
                  assignerRole={userMap.get(t.assigned_by)?.role}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      {rows.length === 0 && (
        <p className="text-muted-foreground">No tasks assigned yet.</p>
      )}
    </div>
  );
}