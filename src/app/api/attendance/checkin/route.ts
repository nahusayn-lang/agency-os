import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginAttendanceStatus, getTodayDateString } from "@/lib/auth/attendance";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const profile = await requireUserProfile();

  try {
    const supabase = createClient();
    const admin = createAdminClient();
    const now = new Date();
    const today = getTodayDateString(now);

    const { data: userRow } = await supabase
      .from("users")
      .select("shift_start, is_checked_in")
      .eq("id", profile.id)
      .single();

    if (userRow?.is_checked_in) {
      return NextResponse.json({ error: "Already checked in." }, { status: 400 });
    }

    const shiftStart = userRow?.shift_start ?? "00:00:00";
    const status = getLoginAttendanceStatus(shiftStart, now);

    const { data: existing } = await admin
      .from("attendance")
      .select("id")
      .eq("user_id", profile.id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await admin
        .from("attendance")
        .update({ checkin_time: now.toISOString(), login_time: now.toISOString(), status })
        .eq("id", existing.id);
    } else {
      await admin.from("attendance").insert({
        user_id: profile.id,
        checkin_time: now.toISOString(),
        login_time: now.toISOString(),
        status,
        date: today,
      });
    }

    await admin
      .from("users")
      .update({ is_checked_in: true, last_checkin_at: now.toISOString() })
      .eq("id", profile.id);

    await supabase.from("audit_log").insert({
      user_id: profile.id,
      action: "checkin",
      entity_type: "attendance",
      entity_id: null,
    });

    // Notify founders + managers if late
    if (status === "late") {
      const timeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      const { data: admins } = await admin
        .from("users")
        .select("id")
        .in("role", ["super_admin", "admin"])
        .eq("is_active", true);

      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.id,
            title: "Late check-in",
            message: `${profile.name} aaj late aaya — ${timeStr}`,
            link: "/attendance",
            type: "attendance",
          }))
        );
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}