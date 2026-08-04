"use server";

import "server-only";
import { cookies } from "next/headers";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { writeAuditEvent } from "@/lib/services/audit-service";
import type { UserRole } from "@/lib/types/database";

function isUserRole(value: string): value is UserRole {
  return value === "super_admin" || value === "admin" || value === "member";
}

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const userId = data.user.id;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("role, is_active")
    .eq("id", userId)
    .single<{
      role: string;
      is_active: boolean;
    }>();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: "User profile not found. Contact an administrator." };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Your account is inactive." };
  }

  if (!isUserRole(profile.role)) {
    await supabase.auth.signOut();
    return { error: "Your account has an invalid role." };
  }

  await writeAuditEvent({
    userId,
    action: "login",
    entityType: "session",
    entityId: null,
  });

  redirect(getDashboardPathForRole(profile.role));
}

export async function logoutAction(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await writeAuditEvent({
      userId: user.id,
      action: "logout",
      entityType: "session",
      entityId: null,
    });
  } catch {
    await supabase.auth.signOut();
    cookies().delete("agencyos_role_cache");
    redirect("/login?error=audit_failed");
  }

  await supabase.auth.signOut();
  cookies().delete("agencyos_role_cache");
  redirect("/login");
}