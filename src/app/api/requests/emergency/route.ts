import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const profile = await requireUserProfile();
  try {
    const form = await req.formData();
    const note = String(form.get("note") ?? "").trim();
    if (!note) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: founders } = await supabase
      .from("users")
      .select("id, email")
      .eq("role", "super_admin")
      .eq("is_active", true);

    for (const f of founders ?? []) {
      await supabase.from("notifications").insert({
        user_id: f.id,
        title: "Emergency checkout request",
        message: `User ${profile.name} requests checkout: ${note}`,
        link: "/dashboard",
      });
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
