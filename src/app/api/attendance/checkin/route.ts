import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { recordLoginAttendance } from "@/lib/services/attendance-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const profile = await requireUserProfile();
  try {
    const supabase = createClient();
    const { data: userRow } = await supabase.from("users").select("shift_start").eq("id", profile.id).single();
    const shiftStart = userRow?.shift_start ?? "00:00:00";
    await recordLoginAttendance(profile.id, shiftStart);
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
