"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

async function recordReportAudit(supabase: ReturnType<typeof createClient>, params: { userId: string; reportId: string; action: string }) {
  const { error } = await supabase.from("reports_audit").insert({ report_id: params.reportId, user_id: params.userId, action: params.action });
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from("audit_log").insert({ user_id: params.userId, action: "report_submission", entity_type: "report", entity_id: params.reportId, reason: params.action });
  if (auditError) throw new Error(auditError.message);
}

export async function createReportAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const profile = await requireUserProfile();
  const what = (formData.get("what_i_did_today") as string) ?? "";
  const completed = (formData.get("completed_work") as string) ?? "";
  const pending = (formData.get("pending_work") as string) ?? "";
  const blockers = (formData.get("blockers") as string) ?? "";

  if (!what.trim() || !completed.trim() || !pending.trim() || !blockers.trim()) {
    return { error: "All fields are required." };
  }

  const supabase = createClient();

  const { data: report, error } = await supabase
    .from("reports")
    .insert({ user_id: profile.id, what_i_did_today: what.trim(), completed_work: completed.trim(), pending_work: pending.trim(), blockers: blockers.trim() })
    .select("id")
    .single();

  if (error || !report) return { error: error?.message ?? "Failed to create report." };

  await recordReportAudit(supabase, { userId: profile.id, reportId: report.id, action: "report_submitted" });
  revalidatePath("/reports");
  return { success: true };
}

export async function createReportFormAction(formData: FormData): Promise<void> {
  const result = await createReportAction(formData);
  if (result?.error) redirect(`/reports?error=${encodeURIComponent(result.error)}`);
  redirect("/reports");
}

export async function getReportsForMember(userId: string) {
  await requireUserProfile();
  const supabase = createClient();
  const { data, error } = await supabase.from("reports").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllReportsForAdmin(memberId?: string, dateFilter?: string) {
  const profile = await requireUserProfile();
  if (profile.role === "member") throw new Error("Unauthorized");
  const supabase = createClient();

  let query = supabase.from("reports").select("*, users:user_id(id, name, email)").order("created_at", { ascending: false });
  if (memberId) query = query.eq("user_id", memberId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  if (dateFilter) {
    const filterDate = new Date(dateFilter).toDateString();
    return (data ?? []).filter((r: { created_at: string }) => new Date(r.created_at).toDateString() === filterDate);
  }

  return data ?? [];
}
