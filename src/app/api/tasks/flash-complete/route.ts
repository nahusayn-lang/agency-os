import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications/notify";

export async function POST(req: Request) {
  try {
    const profile = await requireUserProfile();
    const { taskId } = await req.json();

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required." }, { status: 400 });
    }

    const supabase = createClient();

    const { data: task, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title, assigned_to, assigned_by, is_flash_task, status")
      .eq("id", taskId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }
    if (!task.is_flash_task) {
      return NextResponse.json({ error: "Not a Flash Task." }, { status: 400 });
    }
    if (task.assigned_to !== profile.id) {
      return NextResponse.json({ error: "Not your task." }, { status: 403 });
    }
    if (task.status !== "in_progress") {
      return NextResponse.json({ error: "Task is not active." }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", taskId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await notifyUser({
      userId: task.assigned_by,
      title: "Flash Task Completed",
      message: `${profile.name} completed the Flash Task "${task.title}" on time.`,
      link: "/tasks",
      type: "flash_task_completed",
      referenceId: task.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}