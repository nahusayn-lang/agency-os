import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    // Always use the logged-in user's own id — never trust a userId sent
    // from the client, or anyone could hijack someone else's push
    // subscription by simply sending a different id.
    const profile = await requireUserProfile();
    const { subscription } = await req.json();

    if (!subscription) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const admin = createAdminClient();

    await admin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: profile.id,
          subscription: JSON.stringify(subscription),
        },
        { onConflict: "user_id" }
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}