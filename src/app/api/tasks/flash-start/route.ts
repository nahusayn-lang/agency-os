import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

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
      .select("id, assigned_to, is_flash_task, flash_duration_hours, status")
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
    if (task.status !== "pending") {
      return NextResponse.json({ error: "Task already started." }, { status: 400 });
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + (task.flash_duration_hours ?? 2) * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        session_start_time: now.toISOString(),
        deadline: deadline.toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deadline: deadline.toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}