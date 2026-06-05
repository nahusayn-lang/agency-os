"use server";

import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { writeAuditEvent } from "@/lib/services/audit-service";
import {
  recordLoginAttendance,
  recordLogoutAttendance,
} from "@/lib/services/attendance-service";
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
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("role, shift_start, is_active")
    .eq("id", userId)
    .single<{
      role: string;
      shift_start: string;
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

  let attendanceId: string;

  try {
    const result = await recordLoginAttendance(userId, profile.shift_start);
    attendanceId = result.attendanceId;
  } catch {
    await supabase.auth.signOut();
    return { error: "Failed to record attendance. Please try again." };
  }

  try {
    await writeAuditEvent({
      userId,
      action: "login",
      entityType: "session",
      entityId: attendanceId,
    });
  } catch {
    await admin.from("attendance").delete().eq("id", attendanceId);
    await supabase.auth.signOut();
    return { error: "Failed to record audit log. Please try again." };
  }

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

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("shift_end")
    .eq("id", user.id)
    .single<{ shift_end: string }>();

  let attendanceId: string | null = null;

  if (profile?.shift_end) {
    try {
      attendanceId = await recordLogoutAttendance(user.id, profile.shift_end);
    } catch {
      await supabase.auth.signOut();
      redirect("/login?error=logout_failed");
    }
  }

  try {
    await writeAuditEvent({
      userId: user.id,
      action: "logout",
      entityType: "session",
      entityId: attendanceId,
    });
  } catch {
    await supabase.auth.signOut();
    redirect("/login?error=audit_failed");
  }

  await supabase.auth.signOut();
  redirect("/login");
}
