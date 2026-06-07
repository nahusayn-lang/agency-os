"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/session";

export async function toggleUserActiveAction(formData: FormData): Promise<void> {
  const profile = await requireUserProfile();
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    throw new Error("Not authorized");
  }

  const id = String(formData.get("userId") ?? "");
  const isActive = String(formData.get("isActive") ?? "false") === "true";

  if (!id) throw new Error("Missing user id");

  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}

export async function setUserRoleAction(formData: FormData): Promise<void> {
  const profile = await requireUserProfile();
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    throw new Error("Not authorized");
  }

  const id = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!id || !role) throw new Error("Missing parameters");

  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}
