import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { setUserColdCallExempt } from "@/lib/services/cold-call-settings";

export async function POST(req: Request) {
  const profile = await requireUserProfile();
  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only the founder can change this setting." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const userId = String(body.userId ?? "");
    const exempt = Boolean(body.exempt);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    await setUserColdCallExempt(userId, exempt, profile.id);
    return NextResponse.json({ success: true, userId, exempt });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}