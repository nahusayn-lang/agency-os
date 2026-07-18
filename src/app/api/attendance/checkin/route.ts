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

    // Step 1: Purani "open" absent entry dhoondo — koi bhi record jiska
    // checkin_time null hai (matlab kabhi check-in nahi hua, sirf absent
    // lagi thi). Aisa record tab tak "open" rehta hai jab tak uski *agli*
    // shift-occurrence shuru nahi ho jaati (shift daily repeat hoti hai).
    const { data: openAbsent } = await admin
      .from("attendance")
      .select("id, date")
      .eq("user_id", profile.id)
      .eq("status", "absent")
      .is("checkin_time", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let linkToRecordId: string | null = null;

    if (openAbsent && shiftStart) {
      // Agli occurrence ka start-time = us purani entry ki date + 1 din, shift_start pe.
      const nextOccurrenceStart = new Date(
        `${openAbsent.date}T${shiftStart}+05:30`
      );
      nextOccurrenceStart.setDate(nextOccurrenceStart.getDate() + 1);

      if (now < nextOccurrenceStart) {
        // Abhi bhi dead-zone mein hai — agla shift start nahi hua — isliye
        // ye check-in purani hi absent-entry mein jaayega, naya row nahi.
        linkToRecordId = openAbsent.id;
      }
    }

    const isAfterShiftEnd =
      !!shiftEnd && !linkToRecordId && now > new Date(`${today}T${shiftEnd}+05:30`);

    let evaluation = { status: "present" as "present" | "late", strikeTriggered: false, graceUsed: false };
    let status: string = "present";

    if (linkToRecordId || isAfterShiftEnd) {
      status = "absent";
    } else {
      evaluation = await evaluateCheckin(profile.id, shiftStart, now);
      status = evaluation.status;
    }

    const isRecovery = !!linkToRecordId || isAfterShiftEnd;

    const { data: existing } = linkToRecordId
      ? { data: { id: linkToRecordId } }
      : await admin
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
          ...(isRecovery ? { late_checkin_after_absent: true } : {}),
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
          ...(isRecovery ? { late_checkin_after_absent: true } : {}),
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

    if (isRecovery) {
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
            title: "Post-Shift Check-in",
            message: `${profile.name} checked in after shift end (${timeStr}) — attendance is still marked "absent". Review and manually adjust if needed.`,
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
          ? `${profile.name} arrived late (${timeStr}) — grace period exhausted, 1 strike issued.`
          : `${profile.name} arrived late (${timeStr}) — grace period used.`;

        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.id,
            title: "Late Check-in",
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