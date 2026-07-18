import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasPendingCannotCompleteApproval } from "@/lib/services/strike-fine-engine";

// This route ONLY performs validation (blocked tasks / pending approval).
// The actual checkout (is_checked_in=false, checkout_time, audit log) now
// happens in the /api/attendance/submit-report route — so checkout is
// never marked complete in the DB without a submitted report (refresh-safe).
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
          message: "A 'cannot complete' request is awaiting super admin approval. Checkout is blocked until then.",
        },
        { status: 403 }
      );
    }

    // Validation passed — the report is still pending. Set this flag so
    // that even after a refresh, the dashboard knows to show the report
    // modal again.
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