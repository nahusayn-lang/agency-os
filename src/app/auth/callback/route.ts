import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If this callback was part of a recovery flow, forward the
      // original search params to `/reset-password` so the client can
      // establish the session and allow the user to set a new password.
      const isRecovery = searchParams.get("type") === "recovery";
      if (isRecovery) {
        const qs = searchParams.toString();
        return NextResponse.redirect(`${origin}/reset-password?${qs}`);
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}