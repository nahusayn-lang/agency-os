import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/session";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
  try {
    // This route was reachable with no login check at all — anyone could
    // push a fake notification to any user. Only allow it now, and only
    // to the logged-in user themself.
    const profile = await requireUserProfile();
    const { title, message, link } = await req.json();

    const admin = createAdminClient();

    const { data: sub } = await admin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", profile.id)
      .single();

    if (!sub) return NextResponse.json({ error: "No subscription" }, { status: 404 });

    const payload = JSON.stringify({ title, message, link });
    await webpush.sendNotification(JSON.parse(sub.subscription), payload);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}