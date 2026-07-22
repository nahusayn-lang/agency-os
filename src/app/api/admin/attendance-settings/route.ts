import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { getSundayOffSetting, setSundayOffSetting } from "@/lib/services/attendance-settings";

export async function GET() {
  await requireUserProfile();
  const sundayOff = await getSundayOffSetting();
  return NextResponse.json({ sundayOff });
}

export async function POST(req: Request) {
  const profile = await requireUserProfile();
  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only the founder can change this setting." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const sundayOff = Boolean(body.sundayOff);
    await setSundayOffSetting(sundayOff, profile.id);
    return NextResponse.json({ success: true, sundayOff });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}