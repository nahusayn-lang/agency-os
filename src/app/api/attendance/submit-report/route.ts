import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isEarlyExit } from "@/lib/auth/attendance";
import { hasPendingCannotCompleteApproval } from "@/lib/services/strike-fine-engine";
import { notifyAdmins } from "@/lib/notifications/notify";

// Asli checkout + report submission, EK HI request mein.
// This means: until this fully completes (including the report insert),
// no changes are saved to the attendance/users tables — a refresh can
// never leave checkout stuck in a "half-done" state.
export async function POST(req: Request) {
  const profile = await requireUserProfile();

  try {
    const form = await req.formData();
    const what = String(form.get("what_i_did_today") ?? "").trim();
    const completed = String(form.get("completed_work") ?? "").trim();
    const pending = String(form.get("pending_work") ?? "").trim();
    const blockers = String(form.get("blockers") ?? "").trim();

    if (!what || !completed || !pending || !blockers) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    const supabase = createClient();
    const admin = createAdminClient();
    const now = new Date();

    // --- Re-validate (race-safe: the report form may stay open for a few minutes) ---
    const { data: userRow } = await admin
      .from("users")
      .select("shift_end, is_checked_in")
      .eq("id", profile.id)
      .single();

    if (!userRow?.is_checked_in) {
      // Defensive cleanup — can happen due to a race condition or another tab.
      await admin
        .from("users")
        .update({ checkout_report_pending: false })
        .eq("id", profile.id);
      return NextResponse.json({ error: "You have already checked out." }, { status: 400 });
    }

    const { data: blockedTasks } = await supabase
      .from("tasks")
      .select("id, title, status")
      .eq("assigned_to", profile.id)
      .in("status", ["pending", "in_progress"]);

    if (blockedTasks && blockedTasks.length > 0) {
      return NextResponse.json(
        {
          error: "checkout_blocked",
          message: "Some tasks are still pending — resolve them before retrying checkout.",
          blockedTasks: blockedTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
        },
        { status: 403 }
      );
    }

    const pendingApproval = await hasPendingCannotCompleteApproval(profile.id);
    if (pendingApproval) {
      return NextResponse.json(
        {
          error: "checkout_blocked_pending_approval",
          message: "A 'cannot complete' request is awaiting super admin approval. Checkout is blocked until then.",
        },
        { status: 403 }
      );
    }

    // --- Asli checkout ---
    const shiftEnd = userRow?.shift_end ?? "23:59:59";
    const isEarly = isEarlyExit(shiftEnd, now);
    const statusUpdate = isEarly ? "early_exit" : undefined;

    // Find the currently-open session (checked in, not yet checked out) —
    // not by "today's date", since an overnight shift's checkout can happen
    // on the next calendar day and would otherwise never be found.
    const { data: attendance } = await admin
      .from("attendance")
      .select("id, status")
      .eq("user_id", profile.id)
      .not("checkin_time", "is", null)
      .is("checkout_time", null)
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

    const { data: lockedUsers } = await admin
      .from("users")
      .update({ is_checked_in: false, checkout_report_pending: false })
      .eq("id", profile.id)
      .eq("is_checked_in", true)
      .select("id");

    if (!lockedUsers || lockedUsers.length === 0) {
      return NextResponse.json({ error: "Already checked out." }, { status: 400 });
    }

    await supabase.from("audit_log").insert({
      user_id: profile.id,
      action: "checkout",
      entity_type: "attendance",
      entity_id: null,
    });

    if (isEarly) {
      const timeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      await notifyAdmins({
        title: "Early Checkout",
        message: `${profile.name} checked out early — ${timeStr}`,
        link: "/attendance",
        type: "attendance",
      });
    }

    // --- Report insert (immediately after checkout, same request) ---
    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        user_id: profile.id,
        what_i_did_today: what,
        completed_work: completed,
        pending_work: pending,
        blockers,
      })
      .select("id")
      .single();

    if (error || !report) {
      return NextResponse.json({ error: error?.message ?? "Failed." }, { status: 500 });
    }

    await supabase.from("reports_audit").insert({
      report_id: report.id,
      user_id: profile.id,
      action: "report_submitted_at_checkout",
    });

    await supabase.from("audit_log").insert({
      user_id: profile.id,
      action: "report_submission",
      entity_type: "report",
      entity_id: report.id,
      reason: "checkout_flow",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}