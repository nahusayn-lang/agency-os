"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDashboardPathForRole } from "@/lib/auth/roles";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // If URL hash contains an access_token (e.g., recovery link landed on /#access_token=...)
    // forward the user to /reset-password preserving search and hash so the
    // ResetPasswordForm can pick up tokens.
    const { search, hash } = window.location;
    const hasHashToken = hash && (hash.includes("access_token=") || hash.includes("type=recovery"));
    const params = new URLSearchParams(search);
    const hasRecoveryQuery = params.get("type") === "recovery" || params.get("code") || params.get("access_token") || params.get("refresh_token");

    if (hasHashToken || hasRecoveryQuery) {
      const target = `/reset-password${search}${hash}`;
      router.replace(target);
      return;
    }

    // Otherwise check session and route accordingly
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(
          ({ data }) => {
            const role = data?.role;
            const path = role ? getDashboardPathForRole(role) : "/login";
            router.replace(path);
          },
          () => router.replace("/login")
        );
    });
  }, [router]);

  return null;
}
