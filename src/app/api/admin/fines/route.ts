import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications/notify";

export async function POST(req: Request) {
  const profile = await requireUserProfile();

  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Sirf founder fine mark/waive kar sakta hai." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const fineId = String(body.fineId ?? "");
    const action = body.action as "paid" | "waived" | "reject";

    if (!fineId || (action !== "paid" && action !== "waived" && action !== "reject")) {
      return NextResponse.json({ error: "fineId aur valid action required hai." }, { status: 400 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      reviewed_by: profile.id,
      reviewed_at: now,
    };
    if (action === "paid") {
      updates.status = "paid";
      updates.paid_at = now;
    } else if (action === "waived") {
      updates.status = "waived";
    } else {
      // reject: send back from 'submitted' to 'pending' — proof was insufficient
      updates.status = "pending";
    }

    const { data: fine, error } = await admin
      .from("fines")
      .update(updates)
      .eq("id", fineId)
      .select("id, user_id, amount")
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

    const messages: Record<string, string> = {
      paid: `Tumhara ₹${fine.amount} fine paid confirm ho gaya hai.`,
      waived: "Tumhara fine waive kar diya gaya hai.",
      reject: `Tumhara ₹${fine.amount} fine ka proof reject hua — dobara submit karo.`,
    };
    const titles: Record<string, string> = {
      paid: "Fine paid confirmed",
      waived: "Fine waived",
      reject: "Fine proof rejected",
    };

    await notifyUser({
      userId: fine.user_id,
      title: titles[action],
      message: messages[action],
      link: "/attendance",
      type: "fine",
      referenceId: fineId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

/** Employee submits payment proof (mandatory screenshot) + optional comment on a pending fine. */
export async function PATCH(req: Request) {
  const profile = await requireUserProfile();

  try {
    const body = await req.json();
    const fineId = String(body.fineId ?? "");
    const proofUrl = String(body.proofUrl ?? "").trim();
    const paymentComment = String(body.paymentComment ?? "").trim();

    if (!fineId) return NextResponse.json({ error: "fineId required hai." }, { status: 400 });
    if (!proofUrl) return NextResponse.json({ error: "Payment screenshot lagana zaroori hai." }, { status: 400 });

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
      return NextResponse.json({ error: "Sirf pending fine par payment submit kar sakte ho." }, { status: 400 });

    const { error } = await admin
      .from("fines")
      .update({
        proof_url: proofUrl,
        payment_comment: paymentComment || null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", fineId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fine proof verification is founder-only — only super_admins get this.
    const { data: founders } = await admin.from("users").select("id").eq("role", "super_admin");
    for (const f of founders ?? []) {
      await notifyUser({
        userId: f.id,
        title: "Fine payment awaiting confirmation",
        message: `${profile.name} ne fine payment proof submit kiya hai.`,
        link: "/dashboard/founder",
        type: "fine",
        referenceId: fineId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}