import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { reviewCannotComplete } from "@/lib/services/strike-fine-engine";

export async function POST(req: Request) {
  const profile = await requireUserProfile();

  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super admin can approve or reject this." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const usageId = String(body.usageId ?? "");
    const decision = body.decision as "approved" | "rejected";

    if (!usageId || (decision !== "approved" && decision !== "rejected")) {
      return NextResponse.json({ error: "usageId and decision are required." }, { status: 400 });
    }

    await reviewCannotComplete(usageId, profile.id, decision);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}