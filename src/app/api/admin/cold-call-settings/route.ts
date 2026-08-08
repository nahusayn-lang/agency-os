import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import {
  getDefaultColdCallTarget,
  setDefaultColdCallTarget,
  listColdCallTargets,
} from "@/lib/services/cold-call-settings";

export async function GET() {
  const profile = await requireUserProfile();
  const defaultTarget = await getDefaultColdCallTarget();

  if (profile.role !== "super_admin") {
    return NextResponse.json({ defaultTarget });
  }

  const members = await listColdCallTargets();
  return NextResponse.json({ defaultTarget, members });
}

export async function POST(req: Request) {
  const profile = await requireUserProfile();
  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only the founder can change this setting." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const target = Number(body.defaultTarget);
    await setDefaultColdCallTarget(target, profile.id);
    return NextResponse.json({ success: true, defaultTarget: target });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}