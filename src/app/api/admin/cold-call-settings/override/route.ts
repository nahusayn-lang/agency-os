import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { setUserColdCallOverride } from "@/lib/services/cold-call-settings";

export async function POST(req: Request) {
  const profile = await requireUserProfile();
  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only the founder can change this setting." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const userId = String(body.userId ?? "");
    const target = body.target === null || body.target === "" ? null : Number(body.target);

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    await setUserColdCallOverride(userId, target, profile.id);
    return NextResponse.json({ success: true, userId, target });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}