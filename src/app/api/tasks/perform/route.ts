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

  const supabase = createClient();

  try {
    if (action === "start") {
      // Session start time save karo DB mein
      await supabase
        .from("tasks")
        .update({ session_start_time: new Date().toISOString() })
        .eq("id", taskId);

      const res = await updateTaskStatusAction(taskId, "in_progress");
      return NextResponse.json(res);
    }

    if (action === "pause") {
      if (!note || !String(note).trim()) {
        return NextResponse.json({ error: "Pause note required" }, { status: 400 });
      }

      // Session ka time calculate karo
      const { data: t } = await supabase
        .from("tasks")
        .select("total_time_spent_seconds, session_start_time")
        .eq("id", taskId)
        .single();

      const current = (t?.total_time_spent_seconds as number) ?? 0;
      let sessionSeconds = 0;

      if (t?.session_start_time) {
        const started = new Date(t.session_start_time).getTime();
        const now = Date.now();
        sessionSeconds = Math.floor((now - started) / 1000);
      }

      const newTotal = current + sessionSeconds;

      // Total time update karo aur session_start_time clear karo
      await supabase
        .from("tasks")
        .update({
          total_time_spent_seconds: newTotal,
          session_start_time: null,
        })
        .eq("id", taskId);

      // Comment add karo pause reason ke saath
      const msgParts = [String(note).trim(), `Time this session: ${sessionSeconds}s`];
      const c = await addTaskCommentAction(taskId, msgParts.join("\n"));

      const s = await updateTaskStatusAction(taskId, "paused");
      return NextResponse.json({ success: true, comment: c, status: s });
    }

    if (action === "submit") {
      // Session ka time calculate karo
      const { data: t } = await supabase
        .from("tasks")
        .select("total_time_spent_seconds, session_start_time")
        .eq("id", taskId)
        .single();

      const current = (t?.total_time_spent_seconds as number) ?? 0;
      let sessionSeconds = 0;

      if (t?.session_start_time) {
        const started = new Date(t.session_start_time).getTime();
        const now = Date.now();
        sessionSeconds = Math.floor((now - started) / 1000);
      }

      const newTotal = current + sessionSeconds;

      // Final total save karo aur session clear karo
      await supabase
        .from("tasks")
        .update({
          total_time_spent_seconds: newTotal,
          session_start_time: null,
        })
        .eq("id", taskId);

      const result = await submitTaskAction(taskId, String(note ?? "").trim(), optionalLink);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}