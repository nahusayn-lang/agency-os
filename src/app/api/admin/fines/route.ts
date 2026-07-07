import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const profile = await requireUserProfile();

  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Sirf super_admin fine mark/waive kar sakta hai." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const fineId = String(body.fineId ?? "");
    const action = body.action as "paid" | "waived";

    if (!fineId || (action !== "paid" && action !== "waived")) {
      return NextResponse.json({ error: "fineId aur action (paid/waived) required hai." }, { status: 400 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      status: action,
      reviewed_by: profile.id,
      reviewed_at: now,
    };
    if (action === "paid") updates.paid_at = now;

    const { data: fine, error } = await admin
      .from("fines")
      .update(updates)
      .eq("id", fineId)
      .select("id, user_id")
      .single();

    if (error || !fine) {
      return NextResponse.json({ error: error?.message ?? "Fine not found." }, { status: 404 });
    }

    await admin.from("audit_log").insert({
      user_id: profile.id,
      action: `fine_${action}`,
      entity_type: "fine",
      entity_id: fineId,
    });

    await admin.from("notifications").insert({
      user_id: fine.user_id,
      title: action === "paid" ? "Fine marked as paid" : "Fine waived",
      message:
        action === "paid"
          ? "Tumhara ₹100 fine paid mark ho gaya hai."
          : "Tumhara fine waive kar diya gaya hai.",
      link: "/attendance",
      type: "fine",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

/** Employee submits dispute proof (screenshot URL) + reason on a pending fine. */
export async function PATCH(req: Request) {
  const profile = await requireUserProfile();

  try {
    const body = await req.json();
    const fineId = String(body.fineId ?? "");
    const proofUrl = String(body.proofUrl ?? "").trim();
    const disputeReason = String(body.disputeReason ?? "").trim();

    if (!fineId) return NextResponse.json({ error: "fineId required hai." }, { status: 400 });

    const admin = createAdminClient();

    const { data: fine, error: fetchError } = await admin
      .from("fines")
      .select("id, user_id, status")
      .eq("id", fineId)
      .single();

    if (fetchError || !fine) return NextResponse.json({ error: "Fine not found." }, { status: 404 });
    if (fine.user_id !== profile.id)
      return NextResponse.json({ error: "Ye fine tumhara nahi hai." }, { status: 403 });
    if (fine.status !== "pending")
      return NextResponse.json({ error: "Sirf pending fine par dispute daal sakte ho." }, { status: 400 });

    const { error } = await admin
      .from("fines")
      .update({ proof_url: proofUrl || null, dispute_reason: disputeReason || null })
      .eq("id", fineId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}