import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { removeStrike } from "@/lib/services/strike-fine-engine";

export async function POST(req: Request) {
  const profile = await requireUserProfile();

  // Rule 6: strike removal is founder-only, private — never visible to admin/member.
  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const strikeId = String(body.strikeId ?? "");
    const reason = String(body.reason ?? "").trim();

    if (!strikeId || !reason) {
      return NextResponse.json({ error: "strikeId and reason are required." }, { status: 400 });
    }

    await removeStrike(strikeId, profile.id, reason);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}