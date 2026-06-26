import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

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