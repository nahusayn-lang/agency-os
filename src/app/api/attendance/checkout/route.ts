import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { recordLogoutAttendance } from "@/lib/services/attendance-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const profile = await requireUserProfile();
  try {
    const supabase = createClient();
    const { data: userRow } = await supabase.from("users").select("shift_end").eq("id", profile.id).single();
    const shiftEnd = userRow?.shift_end ?? "23:59:59";
    await recordLogoutAttendance(profile.id, shiftEnd);
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
