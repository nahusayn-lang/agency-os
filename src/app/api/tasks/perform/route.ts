import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { updateTaskStatusAction, addTaskCommentAction, submitTaskAction } from "@/lib/tasks/actions";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  await requireUserProfile();
  const body = await req.json();
  const { action, taskId, note, optionalLink, totalTimeSeconds } = body ?? {};

  if (!action || !taskId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    if (action === "start") {
      const res = await updateTaskStatusAction(taskId, "in_progress");
      return NextResponse.json(res);
    }
    if (action === "pause") {
      if (!note || !String(note).trim()) {
        return NextResponse.json({ error: "Pause note required" }, { status: 400 });
      }
      // add a comment with the note and optional time
      const msgParts = [String(note).trim()];
      if (typeof totalTimeSeconds === "number") msgParts.push(`Time chunk (s): ${totalTimeSeconds}`);
      const c = await addTaskCommentAction(taskId, msgParts.join("\n"));
      // persist total time chunk to task
      if (typeof totalTimeSeconds === "number") {
        const supabase = createClient();
        const { data: t } = await supabase.from("tasks").select("total_time_spent_seconds").eq("id", taskId).single();
        const current = (t?.total_time_spent_seconds as number) ?? 0;
        await supabase.from("tasks").update({ total_time_spent_seconds: current + totalTimeSeconds }).eq("id", taskId);
      }

      const s = await updateTaskStatusAction(taskId, "paused");
      return NextResponse.json({ success: true, comment: c, status: s });
    }
    if (action === "submit") {
      const result = await submitTaskAction(taskId, String(note ?? "").trim(), optionalLink);

      // persist total time chunk to task on submit as well
      if (typeof totalTimeSeconds === "number") {
        const supabase = createClient();
        const { data: t } = await supabase.from("tasks").select("total_time_spent_seconds").eq("id", taskId).single();
        const current = (t?.total_time_spent_seconds as number) ?? 0;
        await supabase.from("tasks").update({ total_time_spent_seconds: current + totalTimeSeconds }).eq("id", taskId);
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
