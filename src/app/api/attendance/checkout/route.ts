import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasPendingCannotCompleteApproval } from "@/lib/services/strike-fine-engine";

// Ye route SIRF validation karta hai (blocked tasks / pending approval).
// Asli checkout (is_checked_in=false, checkout_time, audit log) ab
// /api/attendance/submit-report route mein hota hai — taaki report
// submit kiye bina checkout kabhi bhi DB mein complete na ho (refresh-safe).
export async function POST() {
  const profile = await requireUserProfile();

  try {
    const supabase = createClient();
    const admin = createAdminClient();

    const { data: userRow } = await admin
      .from("users")
      .select("is_checked_in")
      .eq("id", profile.id)
      .single();

    if (!userRow?.is_checked_in) {
      return NextResponse.json({ error: "Not checked in." }, { status: 400 });
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

    // Validation pass ho gayi — report abhi bhi baaki hai. Ye flag set
    // karo taaki refresh hone par bhi dashboard ko pata rahe ki report
    // modal dobara dikhana hai.
    await admin
      .from("users")
      .update({ checkout_report_pending: true })
      .eq("id", profile.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}