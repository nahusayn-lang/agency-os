import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayDateString } from "@/lib/auth/attendance";
import { createClient } from "@/lib/supabase/server";
import { evaluateCheckin, addStrike } from "@/lib/services/strike-fine-engine";

export async function POST() {
  const profile = await requireUserProfile();

  try {
    const supabase = createClient();
    const admin = createAdminClient();
    const now = new Date();
    const today = getTodayDateString(now);

    const { data: userRow } = await supabase
      .from("users")
      .select("shift_start, shift_end, is_checked_in")
      .eq("id", profile.id)
      .single();

    if (userRow?.is_checked_in) {
      return NextResponse.json({ error: "Already checked in." }, { status: 400 });
    }

    const shiftStart = userRow?.shift_start ?? "00:00:00";
    const shiftEnd = userRow?.shift_end ?? null;

    // Agar shift already khatam ho chuki hai (matlab sweep isko absent
    // maar chuka ho sakta hai), to check-in normally chalne do — time
    // track hoga, kaam kar sakta hai — lekin "late" mein convert nahi
    // karna hai. Status "absent" hi rehta hai; fine/strike jo already
    // lag chuki hai wo waisi hi rehti hai. Founder record dekh kar
    // manually maaf/adjust kar sakta hai.
    const isAfterShiftEnd =
      !!shiftEnd && now > new Date(`${today}T${shiftEnd}+05:30`);

    let evaluation = { status: "present" as "present" | "late", strikeTriggered: false, graceUsed: false };
    let status: string = "present";

    if (isAfterShiftEnd) {
      status = "absent";
    } else {
      evaluation = await evaluateCheckin(profile.id, shiftStart, now);
      status = evaluation.status;
    }

    const { data: existing } = await admin
      .from("attendance")
      .select("id")
      .eq("user_id", profile.id)
      .eq("date", today)
      .maybeSingle();

    let attendanceId: string | null = existing?.id ?? null;

    if (existing) {
      await admin
        .from("attendance")
        .update({
          checkin_time: now.toISOString(),
          login_time: now.toISOString(),
          status,
          ...(isAfterShiftEnd ? { late_checkin_after_absent: true } : {}),
        })
        .eq("id", existing.id);
    } else {
      const { data: inserted } = await admin
        .from("attendance")
        .insert({
          user_id: profile.id,
          checkin_time: now.toISOString(),
          login_time: now.toISOString(),
          status,
          date: today,
          ...(isAfterShiftEnd ? { late_checkin_after_absent: true } : {}),
        })
        .select("id")
        .single();
      attendanceId = inserted?.id ?? null;
    }

    const { data: lockedUsers } = await admin
  .from("users")
  .update({ is_checked_in: true, last_checkin_at: now.toISOString() })
  .eq("id", profile.id)
  .eq("is_checked_in", false)
  .select("id");

if (!lockedUsers || lockedUsers.length === 0) {
  return NextResponse.json({ error: "Already checked in." }, { status: 400 });
}

    await supabase.from("audit_log").insert({
      user_id: profile.id,
      action: "checkin",
      entity_type: "attendance",
      entity_id: attendanceId,
    });

    if (evaluation.strikeTriggered) {
      await addStrike(profile.id, "late_checkin", attendanceId);
    }

    if (isAfterShiftEnd) {
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
            title: "Shift ke baad check-in",
            message: `${profile.name} ne shift khatam hone ke baad (${timeStr}) check-in kiya — attendance abhi bhi "absent" hai, review karke chaho to manually maaf/adjust kar sakte ho.`,
            link: "/attendance",
            type: "attendance",
          }))
        );
      }
    } else if (status === "late" || evaluation.graceUsed) {
      const timeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      const { data: admins } = await admin
        .from("users")
        .select("id")
        .in("role", ["super_admin", "admin"])
        .eq("is_active", true);

      if (admins?.length) {
        const note = evaluation.strikeTriggered
          ? `${profile.name} late aaya (${timeStr}) — grace khatam, 1 strike lagi hai.`
          : `${profile.name} late aaya (${timeStr}) — grace period use hua.`;

        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.id,
            title: "Late check-in",
            message: note,
            link: "/attendance",
            type: "attendance",
          }))
        );
      }
    }

    return NextResponse.json({
      success: true,
      status,
      strikeAdded: evaluation.strikeTriggered,
      graceUsed: evaluation.graceUsed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}