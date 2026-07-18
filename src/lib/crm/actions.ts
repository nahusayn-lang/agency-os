"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyUser, notifyUsers } from "@/lib/notifications/notify";
import {
  LEAD_STAGES,
  type LeadEditableField,
  type LeadStage,
} from "@/lib/types/crm";

function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

async function writeLeadAuditEntries(
  supabase: ReturnType<typeof createClient>,
  params: {
    leadId: string;
    userId: string;
    changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }>;
  }
) {
  if (params.changes.length === 0) {
    return;
  }

  const rows = params.changes.map((change) => ({
    lead_id: params.leadId,
    changed_by: params.userId,
    field_changed: change.field,
    old_value: change.oldValue,
    new_value: change.newValue,
  }));

  const { error } = await supabase.from("lead_audit").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createLeadFormAction(formData: FormData): Promise<void> {
  const result = await createLeadAction(formData);
  if (result?.error) {
    redirect(`/crm?error=${encodeURIComponent(result.error)}`);
  }
}

export async function createLeadAction(formData: FormData) {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return { error: "Only admins can create leads." };
  }

  const businessName = String(formData.get("business_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "").trim();
  const stage = String(formData.get("stage") ?? "").trim() as LeadStage;
  const nameInput = String(formData.get("name") ?? "").trim();

  if (!businessName || !phone || !assignedTo || !stage) {
    return {
      error: "Business name, phone, assignee, and stage are required.",
    };
  }

  if (!LEAD_STAGES.includes(stage)) {
    return { error: "Invalid stage." };
  }

  const supabase = createClient();

  const assigneeError = await validateLeadAssignee(supabase, assignedTo);
  if (assigneeError) {
    return { error: assigneeError };
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      name: nameInput || businessName,
      business_name: businessName,
      phone,
      email: String(formData.get("email") ?? "").trim() || null,
      stage,
      deal_value: formData.get("deal_value")
        ? Number(formData.get("deal_value"))
        : null,
      assigned_to: assignedTo,
      notes: String(formData.get("notes") ?? "").trim() || null,
      next_followup: formData.get("next_followup")
        ? new Date(String(formData.get("next_followup"))).toISOString()
        : null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { error: error?.message ?? "Failed to create lead." };
  }

  await writeLeadAuditEntries(supabase, {
    leadId: lead.id,
    userId: profile.id,
    changes: [{ field: "stage", oldValue: null, newValue: stage }],
  });

  revalidatePath("/crm");
  redirect(`/crm/${lead.id}`);
}

export async function updateLeadStageAction(leadId: string, newStage: LeadStage) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id, stage, assigned_to, business_name")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return { error: "Lead not found." };
  }

  if (profile.role === "member" && lead.assigned_to !== profile.id) {
    return { error: "You can only move your own leads." };
  }

  const oldStage = lead.stage as LeadStage;
  if (oldStage === newStage) {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ stage: newStage })
    .eq("id", leadId);

  if (updateError) {
    return { error: updateError.message };
  }

  try {
    await writeLeadAuditEntries(supabase, {
      leadId,
      userId: profile.id,
      changes: [
        {
          field: "stage",
          oldValue: oldStage,
          newValue: newStage,
        },
      ],
    });
  } catch (err) {
    await supabase.from("leads").update({ stage: oldStage }).eq("id", leadId);
    return {
      error: err instanceof Error ? err.message : "Failed to write audit.",
    };
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);

  const stageChangeMessage = `${profile.name} updated the stage of lead "${lead.business_name}" from "${oldStage}" to "${newStage}".`;

  // Whoever didn't make the change gets notified (the assignee, if someone
  // else moved their lead).
  if (lead.assigned_to !== profile.id) {
    await notifyUser({
      userId: lead.assigned_to,
      title: "Lead stage updated",
      message: stageChangeMessage,
      link: `/crm/${leadId}`,
      type: "lead_stage_change",
      referenceId: leadId,
    });
  }

  // Founder always gets a separate copy for visibility, unless the founder
  // is the one who made the change themself.
  if (profile.role !== "super_admin") {
    const { data: founders } = await supabase
      .from("users")
      .select("id")
      .eq("role", "super_admin")
      .eq("is_active", true);

    if (founders?.length) {
      await notifyUsers(
        founders.map((f) => f.id),
        {
          title: "Lead stage updated",
          message: stageChangeMessage,
          link: `/crm/${leadId}`,
          type: "lead_stage_change",
          referenceId: leadId,
        }
      );
    }
  }

  return { success: true };
}

export async function updateLeadAction(
  leadId: string,
  updates: Partial<Record<LeadEditableField, string | number | null>>
) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return { error: "Lead not found." };
  }

  if (profile.role === "member" && lead.assigned_to !== profile.id) {
    return { error: "You can only edit your own leads." };
  }

  const dbUpdates: Record<string, unknown> = {};
  const changes: Array<{
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }> = [];

  for (const [field, rawValue] of Object.entries(updates)) {
    const oldValue = serializeValue(lead[field as keyof typeof lead]);
    let newValue: string | null;

    if (field === "deal_value") {
      const num =
        rawValue === null || rawValue === "" ? null : Number(rawValue);
      dbUpdates.deal_value = num;
      newValue = serializeValue(num);
    } else if (field === "last_contact" || field === "next_followup") {
      const iso =
        rawValue === null || rawValue === ""
          ? null
          : new Date(String(rawValue)).toISOString();
      dbUpdates[field] = iso;
      newValue = serializeValue(iso);
    } else {
      const val =
        rawValue === null || rawValue === "" ? null : String(rawValue);
      dbUpdates[field] = val;
      newValue = serializeValue(val);
    }

    if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  }

  if (changes.length === 0) {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update(dbUpdates)
    .eq("id", leadId);

  if (updateError) {
    return { error: updateError.message };
  }

  try {
    await writeLeadAuditEntries(supabase, {
      leadId,
      userId: profile.id,
      changes,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to write audit.",
    };
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
  return { success: true };
}

async function validateLeadAssignee(
  supabase: ReturnType<typeof createClient>,
  assignedTo: string
): Promise<string | null> {
  const { data: assignee, error } = await supabase
    .from("users")
    .select("id, is_active")
    .eq("id", assignedTo)
    .single();

  if (error || !assignee) {
    return "Assignee not found.";
  }

  if (!assignee.is_active) {
    return "Leads can only be assigned to active users.";
  }

  return null;
}

export async function getAssignableUsers() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  if (profile.role === "member") {
    return [];
  }

  const { data } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("is_active", true)
    .order("name");

  const users = data ?? [];

  if (!users.some((user) => user.id === profile.id)) {
    const { data: self } = await supabase
      .from("users")
      .select("id, name, email, role")
      .eq("id", profile.id)
      .eq("is_active", true)
      .single();

    if (self) {
      return [self, ...users].sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return users;
}