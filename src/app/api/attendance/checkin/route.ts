import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayDateString } from "@/lib/auth/attendance";
import { createClient } from "@/lib/supabase/server";
import { evaluateCheckin, addStrike } from "@/lib/services/strike-fine-engine";
import { notifyAdmins } from "@/lib/notifications/notify";

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

    // Step 0: If the user's most recent shift is already fully complete
    // (checkin_time AND checkout_time both set), lock check-in until the
    // *next* shift-occurrence begins. Uses the record's own stored date +
    // shiftStart, not "today", so overnight shifts are handled correctly.
    const { data: lastRecord } = await admin
      .from("attendance")
      .select("id, date, checkout_time")
      .eq("user_id", profile.id)
      .not("checkin_time", "is", null)
      .order("checkin_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRecord?.checkout_time && shiftStart) {
      const nextShiftStart = new Date(`${lastRecord.date}T${shiftStart}+05:30`);
      nextShiftStart.setDate(nextShiftStart.getDate() + 1);

      if (now < nextShiftStart) {
        return NextResponse.json(
          { error: "Your shift is already complete. Check-in opens again when your next shift starts." },
          { status: 400 }
        );
      }
    }

    // Step 1: Find the old "open" absent entry — any record whose
    // checkin_time is null (meaning check-in never happened, only marked
    // absent). Such a record stays "open" until its *next* shift-occurrence
    // begins (shifts repeat daily).
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
      // Next occurrence's start-time = that old entry's date + 1 day, at shift_start.
      const nextOccurrenceStart = new Date(
        `${openAbsent.date}T${shiftStart}+05:30`
      );
      nextOccurrenceStart.setDate(nextOccurrenceStart.getDate() + 1);

      if (now < nextOccurrenceStart) {
        // Still in the dead-zone — next shift hasn't started — so this
        // check-in goes into the old absent-entry, not a new row.
        linkToRecordId = openAbsent.id;
      }
    }

    // "Shift-end" ko hamesha "aaj ki date" se mat nikalo — agar shift raat
    // cross karti hai (jaise 10PM-5AM), to shift asal mein AGLE din khatam
    // hoti hai, aaj nahi. Warna shaam ka on-time check-in bhi "shift already
    // khatam ho chuki" samajh liya jaata hai.
    const crossesMidnight = !!shiftEnd && !!shiftStart && shiftStart > shiftEnd;
    const shiftEndForToday = shiftEnd ? new Date(`${today}T${shiftEnd}+05:30`) : null;
    if (crossesMidnight && shiftEndForToday) {
      shiftEndForToday.setDate(shiftEndForToday.getDate() + 1);
    }
    const isAfterShiftEnd =
      !!shiftEndForToday && !linkToRecordId && now > shiftEndForToday;

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
      await notifyAdmins({
        title: "Post-Shift Check-in",
        message: `${profile.name} checked in after shift end (${timeStr}) — attendance is still marked "absent". Review and manually adjust if needed.`,
        link: "/attendance",
        type: "attendance",
      });
    } else if (status === "late" || evaluation.graceUsed) {
      const timeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      const note = evaluation.strikeTriggered
        ? `${profile.name} arrived late (${timeStr}) — grace period exhausted, 1 strike issued.`
        : `${profile.name} arrived late (${timeStr}) — grace period used.`;

      await notifyAdmins({
        title: "Late Check-in",
        message: note,
        link: "/attendance",
        type: "attendance",
      });
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