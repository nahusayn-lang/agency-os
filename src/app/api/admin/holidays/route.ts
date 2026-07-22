import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { listHolidays, addHoliday, deleteHoliday } from "@/lib/services/attendance-settings";

export async function GET() {
  await requireUserProfile();
  const holidays = await listHolidays();
  return NextResponse.json({ holidays });
}

export async function POST(req: Request) {
  const profile = await requireUserProfile();
  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only the founder can add holidays." }, { status: 403 });
  }

  try {
    const body = await req.json();
    await addHoliday(String(body.name ?? ""), String(body.startDate ?? ""), String(body.endDate ?? ""), profile.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const profile = await requireUserProfile();
  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only the founder can delete holidays." }, { status: 403 });
  }

  try {
    const body = await req.json();
    await deleteHoliday(String(body.id ?? ""));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}