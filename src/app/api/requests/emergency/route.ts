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

    // Notify founders + managers both
    const { data: admins } = await supabase
      .from("users")
      .select("id, email")
      .in("role", ["super_admin", "admin"])
      .eq("is_active", true);

    for (const admin of admins ?? []) {
      await supabase.from("messages").insert({
        sender_id: profile.id,
        recipient_id: admin.id,
        title: "Emergency checkout request",
        content: `${profile.name} requests checkout: ${note}`,
        type: "leave_request",
        status: "pending",
      });

      await supabase.from("notifications").insert({
        user_id: admin.id,
        title: "Emergency checkout request",
        message: `${profile.name} ne emergency checkout maanga: ${note}`,
        link: "/messages",
      });
    }

    return NextResponse.redirect(new URL("/attendance", req.url));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}