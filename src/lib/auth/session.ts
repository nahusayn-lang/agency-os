import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile, UserRole } from "@/lib/types/database";
import { getDashboardPathForRole } from "@/lib/auth/roles";

function isUserRole(value: string): value is UserRole {
  return value === "super_admin" || value === "admin" || value === "member";
}

export async function requireUserProfile(): Promise<UserProfile> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, name, email, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect("/login?error=profile_not_found");
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=account_inactive");
  }

  if (!isUserRole(profile.role)) {
    await supabase.auth.signOut();
    redirect("/login?error=invalid_role");
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
  };
}

export async function requireRole(expectedRole: UserRole): Promise<UserProfile> {
  const profile = await requireUserProfile();

  if (profile.role !== expectedRole) {
    redirect(getDashboardPathForRole(profile.role));
  }

  return profile;
}
