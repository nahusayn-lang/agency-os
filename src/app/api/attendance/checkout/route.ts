import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isEarlyExit, getTodayDateString } from "@/lib/auth/attendance";

export async function POST() {
  const profile = await requireUserProfile();

  try {
    const supabase = createClient();
    const admin = createAdminClient();
    const now = new Date();
    const today = getTodayDateString(now);

    // Check if already checked in
    const { data: userRow } = await admin
      .from("users")
      .select("shift_end, is_checked_in")
      .eq("id", profile.id)
      .single();

    if (!userRow?.is_checked_in) {
      return NextResponse.json({ error: "Not checked in." }, { status: 400 });
    }

    // Block checkout if any task is pending or in_progress
    const { data: blockedTasks } = await supabase
      .from("tasks")
      .select("id, title, status")
      .eq("assigned_to", profile.id)
      .in("status", ["pending", "in_progress"]);

    if (blockedTasks && blockedTasks.length > 0) {
      return NextResponse.json(
        {
          error: "checkout_blocked",
          blockedTasks: blockedTasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
          })),
        },
        { status: 403 }
      );
    }

    // Update attendance
    const shiftEnd = userRow?.shift_end ?? "23:59:59";
    const statusUpdate = isEarlyExit(shiftEnd, now) ? "early_exit" : undefined;

    const { data: attendance } = await admin
      .from("attendance")
      .select("id, status")
      .eq("user_id", profile.id)
      .eq("date", today)
      .order("checkin_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attendance) {
      const updates: Record<string, unknown> = {
        checkout_time: now.toISOString(),
        logout_time: now.toISOString(),
      };
      if (statusUpdate) updates.status = statusUpdate;

      await admin.from("attendance").update(updates).eq("id", attendance.id);
    }

    // Mark user offline
    await admin
      .from("users")
      .update({ is_checked_in: false })
      .eq("id", profile.id);

    await supabase.from("audit_log").insert({
      user_id: profile.id,
      action: "checkout",
      entity_type: "attendance",
      entity_id: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}