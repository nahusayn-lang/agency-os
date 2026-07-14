import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isEarlyExit, getTodayDateString } from "@/lib/auth/attendance";
import { hasPendingCannotCompleteApproval } from "@/lib/services/strike-fine-engine";

// Asli checkout + report submission, EK HI request mein.
// Iska matlab: jab tak ye poori tarah complete nahi hota (report insert
// tak), attendance/users table mein koi change save hi nahi hota — refresh
// karne se checkout "half-done" state mein kabhi nahi phasega.
export async function POST(req: Request) {
  const profile = await requireUserProfile();

  try {
    const form = await req.formData();
    const what = String(form.get("what_i_did_today") ?? "").trim();
    const completed = String(form.get("completed_work") ?? "").trim();
    const pending = String(form.get("pending_work") ?? "").trim();
    const blockers = String(form.get("blockers") ?? "").trim();

    if (!what || !completed || !pending || !blockers) {
      return NextResponse.json({ error: "Saare fields required hain." }, { status: 400 });
    }

    const supabase = createClient();
    const admin = createAdminClient();
    const now = new Date();
    const today = getTodayDateString(now);

    // --- Re-validate (race-safe: kuch mins report form khula reh sakta hai) ---
    const { data: userRow } = await admin
      .from("users")
      .select("shift_end, is_checked_in")
      .eq("id", profile.id)
      .single();

    if (!userRow?.is_checked_in) {
      // Defensive cleanup — kisi race/dusre tab ki wajah se ho sakta hai.
      await admin
        .from("users")
        .update({ checkout_report_pending: false })
        .eq("id", profile.id);
      return NextResponse.json({ error: "Aap already checked out ho." }, { status: 400 });
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
          message: "Kuch tasks abhi bhi pending hain — pehle unhe resolve karo, phir checkout retry karo.",
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
          message: "Ek 'cannot complete' request super_admin approval ka wait kar rahi hai. Checkout tab tak block hai.",
        },
        { status: 403 }
      );
    }

    // --- Asli checkout ---
    const shiftEnd = userRow?.shift_end ?? "23:59:59";
    const isEarly = isEarlyExit(shiftEnd, now);
    const statusUpdate = isEarly ? "early_exit" : undefined;

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
      const { data: admins } = await admin
        .from("users")
        .select("id")
        .in("role", ["super_admin", "admin"])
        .eq("is_active", true);

      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.id,
            title: "Early checkout",
            message: `${profile.name} ne early checkout kiya — ${timeStr}`,
            link: "/attendance",
            type: "attendance",
          }))
        );
      }
    }

    // --- Report insert (checkout ke turant baad, same request) ---
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